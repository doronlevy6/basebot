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

  async shouldTriggerForPotentialUser(
    teamId: string,
    userId: string,
    presence: string,
  ): Promise<boolean> {
    try {
      const [wasOnboarded, isUserLocked] = await Promise.all([
        this.onboardingManager.wasUserOnboarded(teamId, userId),
        this.persistentTriggerLock.isUserLocked(teamId, userId),
      ]);

      // Locked user (already passed the threshold for potential users)
      if (isUserLocked) {
        logger.info(
          `user ${userId} on team ${teamId} is permanently locked, no trigger`,
        );
        return false;
      }

      // User was already onboarded so he is not new
      if (wasOnboarded) {
        logger.info(
          `user ${userId} on team ${teamId} is already onboarded, no trigger`,
        );
        return false;
      }

      const shouldTrigger = await this.triggerLock.shouldTrigger(
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
      );
      if (triggerAmount > MAX_TRIGGER_THRESHOLD) {
        await this.persistentTriggerLock.lockUser(teamId, userId);
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
