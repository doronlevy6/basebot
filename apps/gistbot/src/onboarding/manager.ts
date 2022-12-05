import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import {
  AnalyticsManager,
  PgInstallationStore,
  identifyTriggeringUser,
} from '@base/gistbot-shared';
import { UserLink } from '../slack/components/user-link';
import { Welcome } from '../slack/components/welcome';
import { UserOnboardedNotifier } from './notifier';
import { OnboardingLock } from './onboarding-lock';
import { OnboardingStore } from './onboardingStore';
import { EmailSender } from '@base/emailer';
import { InviteUserTemplate } from './invite-user.template';
import { allowUserByEmails } from '../utils/user-filter.util';
import { OnBoardedUser, OnBoardingContext } from './types';
import {
  NudgeMessage,
  NudgeMessageText,
} from '../slack/components/nudge-message';
import { differenceInDays } from 'date-fns';
import { IReporter } from '@base/metrics';

export class OnboardingManager {
  constructor(
    private store: OnboardingStore,
    private lock: OnboardingLock,
    private analyticsManager: AnalyticsManager,
    private metricsReporter: IReporter,
    private notifier: UserOnboardedNotifier,
    private emailSender: EmailSender,
    private installationStore: PgInstallationStore,
  ) {}

  async wasUserOnboarded(
    teamId: string,
    userId: string,
  ): Promise<OnBoardedUser | undefined> {
    try {
      return await this.store.wasUserOnboarded(teamId, userId);
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
      const onboardedUser = await this.store.wasUserOnboarded(teamId, userId);

      if (onboardedUser && onboardedUser.completedAt) {
        logger.debug(`user ${userId} has already been onboarded`);
        return;
      }

      // Don't await so that we don't force anything to wait just for the identification.
      // This handles error handling internally and will never cause an exception, so we
      // won't have any unhandled promise rejection errors.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      identifyTriggeringUser(userId, teamId, client, this.analyticsManager);

      const acquireOnboarding = await this.lock.lock(teamId, userId);
      if (!acquireOnboarding) {
        logger.debug(
          `user ${userId} is being onboarded elsewhere, skipping ${onboardingContext} onboarding`,
        );
        return;
      }

      let onboardingCompletedAt: Date | undefined = undefined;
      if (onboardingContext !== 'app_home_opened') {
        onboardingCompletedAt = new Date();
      }
      await this.store.userOnboarded(teamId, userId, onboardingCompletedAt);

      if (!onboardedUser) {
        logger.debug(
          `user ${userId} has not yet been onboarded, onboarding now`,
        );
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
        await this.onboardUserViaMail(teamId, userId, client);
        // Don't await so that we don't force anything to wait just for the notification.
        // This handles error handling internally and will never cause an exception, so we
        // won't have any unhandled promise rejection errors.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.notifier.notify(client, userId, teamId);
      }
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

  async filterUsersNotCompletedOnboarding(
    hoursInterval: number,
    daysInterval: number,
    attempts: number,
    limit?: number,
    offset?: number,
  ) {
    const users = await this.store.getUsersNotCompletedOnboarding(
      attempts,
      limit,
      offset,
    );
    logger.debug(`fetched ${users?.length} users to check if should nudge`);
    const filteredUsers: OnBoardedUser[] = [];
    for (const user of users || []) {
      const daysDiff = differenceInDays(new Date(), user.updatedAt);
      const hoursDiff = Math.abs(
        new Date().getHours() - user.updatedAt.getHours(),
      );
      if (daysDiff >= daysInterval && hoursDiff <= hoursInterval) {
        filteredUsers.push(user);
      }
    }
    return filteredUsers;
  }

  async postNudgeMessage(user: OnBoardedUser) {
    logger.debug(`sending onboarding nudge to user ${user.slackUser}`);
    const installation = await this.installationStore.fetchInstallationByTeamId(
      user.slackTeam,
    );
    const token = installation?.bot?.token;
    if (!token) {
      const errMsg = `no token was found for team ${user.slackTeam} when trying to post onboarding nudge message`;
      logger.error(errMsg);
      throw new Error(errMsg);
    }

    await new WebClient(token).chat.postMessage({
      channel: user.slackUser,
      text: NudgeMessageText,
      blocks: NudgeMessage(),
    });

    this.analyticsManager.welcomeMessageInteraction({
      type: 'onboarding_nudge',
      slackUserId: user.slackUser,
      slackTeamId: user.slackTeam,
    });
  }

  async attemptToOnboardUser(user: OnBoardedUser) {
    logger.debug(`attempt to onboard user [${user.slackUser}]`);
    return this.store.userOnboarded(
      user.slackTeam,
      user.slackUser,
      undefined,
      ++user.attempts,
    );
  }
}
