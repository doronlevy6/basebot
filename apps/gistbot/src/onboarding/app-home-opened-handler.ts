import { AnalyticsManager } from '../analytics/manager';
import { UserLink } from '../slack/components/user-link';
import { Welcome } from '../slack/components/welcome';
import { SlackEventWrapper } from '../slack/types';
import { OnboardingStore } from './onboardingStore';

export const appHomeOpenedHandler =
  (onboardingStore: OnboardingStore, analyticsManager: AnalyticsManager) =>
  async ({
    client,
    logger,
    event,
    body,
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

      logger.info(`user ${user} has not yet been onboarded, onboarding now`);

      await client.chat.postMessage({
        channel: user,
        text: `Hey ${UserLink(user)} :wave: I'm theGist!`,
        blocks: Welcome(user),
      });

      analyticsManager.messageSentToUserDM({
        type: 'onboarding_message',
        slackTeamId: team_id,
        slackUserId: user,
      });

      await onboardingStore.userOnboarded(team_id, user);
    } catch (err) {
      logger.error(`Add to channel from welcome modal error: ${err.stack}`);
    }
  };
