import { AnalyticsManager } from '@base/gistbot-shared';
import axios from 'axios';
import { MAIL_BOT_SERVICE_API } from '../email-for-slack/types';
import { SlackEventWrapper } from '../slack/types';
import { OnboardingManager } from './manager';

export const appHomeOpenedHandler =
  (onboardingManager: OnboardingManager, analyticsManager: AnalyticsManager) =>
  async (appOpenedEvent: SlackEventWrapper<'app_home_opened'>) => {
    const { event, body, logger } = appOpenedEvent;
    const { team_id } = body;
    const { user } = event;

    try {
      logger.info(`user ${user} opened the bot DMs`);

      analyticsManager.appHomeOpened({
        slackTeamId: team_id,
        slackUserId: user,
      });

      await Promise.all([
        sendOnboardingIfNeeded(onboardingManager, appOpenedEvent),
        publishHome(team_id, user),
      ]);
    } catch (err) {
      logger.error(`App home opened onboarding error: ${err} ${err.stack}`);
    }
  };

export const sendOnboardingIfNeeded = async (
  onboardingManager: OnboardingManager,
  {
    client,
    logger,
    event,
    context,
    body,
  }: SlackEventWrapper<'app_home_opened'>,
) => {
  const latest = (new Date().getTime() / 1000).toFixed(6);
  const {
    error: historyErr,
    ok: historyOk,
    messages,
  } = await client.conversations.history({
    channel: event.channel,
    limit: 1,
    latest: latest,
  });

  if (historyErr || !historyOk) {
    throw new Error(`Failed to get dm history ${historyErr}`);
  }

  if (
    messages &&
    messages.length &&
    messages[0] &&
    messages[0].user === context.botUserId
  ) {
    // Skip onboarding if the last message in the DM is from the bot so we don't send onboardings when
    // you open the bot DM and there is already a message waiting for you.
    logger.info(`skipping onboarding as the latest message is from the bot`);
    return;
  }

  await onboardingManager.onboardUser(
    body.team_id,
    event.user,
    client,
    'app_home_opened',
  );
};

export const publishHome = async (teamId: string, userId: string) => {
  // TODO: in the future only publish the home if the user has not already seen it via the data store.
  const REFRESH_PATH = '/mail/gmail-client';
  const url = new URL(MAIL_BOT_SERVICE_API);
  url.pathname = REFRESH_PATH;

  await axios.post(url.toString(), {
    slackUserId: userId,
    slackTeamId: teamId,
  });
};
