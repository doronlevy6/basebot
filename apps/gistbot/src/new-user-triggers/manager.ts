import { logger } from '@base/logger';
import { OnboardingManager } from '../onboarding/manager';
import { RedisTriggerLock } from './trigger-lock';
import { PgTriggerLock } from './trigger-lock-persistent';

const MAX_TRIGGER_THRESHOLD = 6;

export class NewUserTriggersManager {
  constructor(
    private onboardingManager: OnboardingManager,
    private triggerLock: RedisTriggerLock,
    private persistentTriggerLock: PgTriggerLock,
  ) {}

  async handleTriggerBlock(
    triggerContext: string,
    teamId: string,
    userId: string,
  ): Promise<void> {
    try {
      await this.persistentTriggerLock.lockUser(triggerContext, teamId, userId);
      logger.info(
        `user ${userId} on team ${teamId} has requested to stop triggering, no trigger`,
      );
    } catch (error) {
      logger.error(
        `error handling user trigger feedback: ${error} ${error.stack}`,
      );
    }
  }

  async handleTriggerHelpful(
    triggerContext: string,
    teamId: string,
    userId: string,
  ): Promise<void> {
    try {
      await this.persistentTriggerLock.unlockUser(
        triggerContext,
        teamId,
        userId,
      );
      await this.triggerLock.clearAllUserTriggersKey(
        teamId,
        userId,
        triggerContext,
      );
      logger.info(
        `user ${userId} on team ${teamId} has requested to continue triggering`,
      );
    } catch (error) {
      logger.error(
        `error handling user trigger feedback: ${error} ${error.stack}`,
      );
    }
  }

  async shouldTriggerForPotentialUser(
    triggerContext: string,
    teamId: string,
    userId: string,
    presence: string,
  ): Promise<boolean> {
    // TODO: For now we are turning the triggers off so that we can send it out to some communities withou spamming.
    // When we add in a settings option to turn off the triggers completely, we will add this back.
    return false;

    try {
      const [wasOnboarded, isUserLocked] = await Promise.all([
        this.onboardingManager.wasUserOnboarded(teamId, userId),
        this.persistentTriggerLock.isUserLocked(triggerContext, teamId, userId),
      ]);

      // Locked user (already passed the threshold for potential users)
      if (isUserLocked) {
        logger.info(
          `user ${userId} on team ${teamId} is permanently locked, no trigger`,
        );
        return false;
      }

      // User was already onboarded so he is not new
      if (wasOnboarded && wasOnboarded?.completedAt) {
        logger.info(
          `user ${userId} on team ${teamId} is already onboarded, no trigger`,
        );
        return false;
      }

      const shouldTrigger = await this.triggerLock.shouldTrigger(
        triggerContext,
        teamId,
        userId,
        presence,
      );

      if (!shouldTrigger) {
        logger.info(
          `user ${userId} on team ${teamId} did not acquire trigger lock, no trigger`,
        );
        return false;
      }

      // Don't trigger more than the trigger threshold
      const triggerAmount = await this.triggerLock.trigger(
        teamId,
        userId,
        presence,
        triggerContext,
      );
      if (triggerAmount > MAX_TRIGGER_THRESHOLD) {
        await this.persistentTriggerLock.lockUser(
          triggerContext,
          teamId,
          userId,
        );
        logger.info(
          `user ${userId} on team ${teamId} has more than ${MAX_TRIGGER_THRESHOLD}, no trigger`,
        );
        return false;
      }

      return shouldTrigger;
    } catch (error) {
      logger.error(`New User Triggers error: ${error} ${error.stack}`);
      throw error;
    }
  }
}
