import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '../analytics/manager';
import { UserLink } from '../slack/components/user-link';
import { Welcome } from '../slack/components/welcome';
import { UserOnboardedNotifier } from './notifier';
import { OnboardingLock } from './onboarding-lock';
import { OnboardingStore } from './onboardingStore';

export class OnboardingManager {
  constructor(
    private store: OnboardingStore,
    private lock: OnboardingLock,
    private analyticsManager: AnalyticsManager,
    private notifier: UserOnboardedNotifier,
  ) {}

  async onboardUser(
    teamId: string,
    userId: string,
    client: WebClient,
    onboardingContext: string,
    botUserId?: string,
  ): Promise<void> {
    try {
      const wasOnboarded = await this.store.wasUserOnboarded(teamId, userId);

      if (wasOnboarded) {
        logger.debug(`user ${userId} has already been onboarded`);
        return;
      }

      const acquireOnboarding = await this.lock.lock(teamId, userId);
      if (!acquireOnboarding) {
        logger.debug(
          `user ${userId} is being onboarded elsewhere, skipping ${onboardingContext} onboarding`,
        );
        return;
      }

      logger.debug(`user ${userId} has not yet been onboarded, onboarding now`);

      await client.chat.postMessage({
        channel: userId,
        text: `Hey ${UserLink(userId)} :wave: I'm theGist!`,
        blocks: Welcome(userId, botUserId || ''),
      });

      this.analyticsManager.messageSentToUserDM({
        type: 'onboarding_message',
        slackTeamId: teamId,
        slackUserId: userId,
        properties: {
          onboardingContext: onboardingContext,
        },
      });

      await this.store.userOnboarded(teamId, userId);

      // Don't await so that we don't force anything to wait just for the notification.
      // This handles error handling internally and will never cause an exception, so we
      // won't have any unhandled promise rejection errors.
      this.notifier.notify(client, userId, teamId);
    } catch (error) {
      logger.error(
        `User onboarding in ${onboardingContext} error: ${error} ${error.stack}`,
      );
    }
  }
}
