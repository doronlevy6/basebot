import { AnalyticsManager } from '../analytics/manager';
import { UserLink } from '../slack/components/user-link';
import { Welcome } from '../slack/components/welcome';
import { SlackEventWrapper } from '../slack/types';
import { UserOnboardedNotifier } from './notifier';
import { OnboardingLock } from './onboarding-lock';
import { OnboardingStore } from './onboardingStore';

export const appHomeOpenedHandler =
  (
    onboardingStore: OnboardingStore,
    analyticsManager: AnalyticsManager,
    onboardingNotifier: UserOnboardedNotifier,
    onboardingLock: OnboardingLock,
  ) =>
  async ({
    client,
    logger,
    event,
    body,
    context,
  }: SlackEventWrapper<'app_home_opened'>) => {
    const { team_id } = body;
    const { user } = event;

    try {
      logger.info(`user ${user} opened the bot DMs`);

      const wasOnboarded = await onboardingStore.wasUserOnboarded(
        team_id,
        user,
      );

      if (wasOnboarded) {
        logger.info(`user ${user} has already been onboarded`);
        return;
      }

      const acquireOnboarding = await onboardingLock.lock(team_id, user);
      if (!acquireOnboarding) {
        logger.info(
          `user ${user} is being onboarded elsewhere, skipping app home onboarding`,
        );
        return;
      }

      logger.info(`user ${user} has not yet been onboarded, onboarding now`);

      await client.chat.postMessage({
        channel: user,
        text: `Hey ${UserLink(user)} :wave: I'm theGist!`,
        blocks: Welcome(user, context.botUserId || ''),
      });

      analyticsManager.messageSentToUserDM({
        type: 'onboarding_message',
        slackTeamId: team_id,
        slackUserId: user,
      });

      await onboardingStore.userOnboarded(team_id, user);

      // Don't await so that we don't force anything to wait just for the notification.
      // This handles error handling internally and will never cause an exception, so we
      // won't have any unhandled promise rejection errors.
      onboardingNotifier.notify(client, user, team_id);
    } catch (err) {
      logger.error(`Add to channel from welcome modal error: ${err.stack}`);
    }
  };
