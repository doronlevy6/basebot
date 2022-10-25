import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '../analytics/manager';
import { UserLink } from '../slack/components/user-link';
import { Welcome } from '../slack/components/welcome';
import { UserOnboardedNotifier } from './notifier';
import { OnboardingLock } from './onboarding-lock';
import { OnboardingStore } from './onboardingStore';
import { EmailSender } from '../email/email-sender.util';
import { InviteUserTemplate } from './invite-user.template';
import { allowUserByEmails } from '../utils/user-filter.util';
import { OnBoardingContext } from './types';
import { IReporter } from '@base/metrics';
import { identifyTriggeringUser } from '../slack/utils';

export class OnboardingManager {
  constructor(
    private store: OnboardingStore,
    private lock: OnboardingLock,
    private analyticsManager: AnalyticsManager,
    private metricsReporter: IReporter,
    private notifier: UserOnboardedNotifier,
    private emailSender: EmailSender,
  ) {}

  async wasUserOnboarded(teamId: string, userId: string): Promise<boolean> {
    try {
      const wasOnboarded = await this.store.wasUserOnboarded(teamId, userId);
      return wasOnboarded;
    } catch (error) {
      logger.error(`Was User onboarded error: ${error} ${error.stack}`);
      throw error;
    }
  }

  async onboardUser(
    teamId: string,
    userId: string,
    client: WebClient,
    onboardingContext: OnBoardingContext,
    botUserId?: string,
  ): Promise<void> {
    try {
      const wasOnboarded = await this.store.wasUserOnboarded(teamId, userId);

      if (wasOnboarded) {
        logger.debug(`user ${userId} has already been onboarded`);
        return;
      }

      // Don't await so that we don't force anything to wait just for the identification.
      // This handles error handling internally and will never cause an exception, so we
      // won't have any unhandled promise rejection errors.
      identifyTriggeringUser(userId, teamId, client, this.analyticsManager);

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
        blocks: Welcome(userId, botUserId || '', onboardingContext),
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
      await this.onboardUserViaMail(teamId, userId, client);

      // Don't await so that we don't force anything to wait just for the notification.
      // This handles error handling internally and will never cause an exception, so we
      // won't have any unhandled promise rejection errors.
      this.notifier.notify(client, userId, teamId);
    } catch (error) {
      logger.error(
        `User onboarding in ${onboardingContext} error: ${error} ${error.stack}`,
      );
      this.metricsReporter.error('onboarding', 'onboard-user');
    }
  }

  async onboardUserViaMail(
    teamId: string,
    userId: string,
    client: WebClient,
  ): Promise<void> {
    try {
      const data = await client.users.profile.get({ user: userId });
      if (!data?.profile?.email) {
        logger.error(`Could not get user data`);
        return;
      }

      if (!allowUserByEmails(data?.profile?.email)) {
        return;
      }

      await this.emailSender.sendEmail({
        to: data.profile.email,
        ...InviteUserTemplate(),
      });
      this.analyticsManager.emailSentToUserDM({
        type: 'invite',
        slackUserId: userId,
        slackTeamId: teamId,
      });
    } catch (error) {
      logger.error(`user invite mail error: ${error} ${error.stack}`);
    }
  }
}
