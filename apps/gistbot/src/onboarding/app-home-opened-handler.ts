import { AnalyticsManager } from '@base/gistbot-shared';
import { EventEmitter } from 'events';
import { UPDATE_HOME_USER_REFRESH } from '../home/types';
import { SlackEventWrapper } from '../slack/types';
import { OnboardingManager } from './manager';

export const appHomeOpenedHandler =
  (
    onboardingManager: OnboardingManager,
    analyticsManager: AnalyticsManager,
    eventsEmitter: EventEmitter,
  ) =>
  async (appOpenedEvent: SlackEventWrapper<'app_home_opened'>) => {
    const { event, body, logger, payload } = appOpenedEvent;
    const { team_id } = body;
    const { user } = event;

    try {
      logger.info(`user ${user} opened the bot DMs`);
      analyticsManager.appHomeOpened({
        slackTeamId: team_id,
        slackUserId: user,
      });
      if (payload.tab === 'home') {
        eventsEmitter.emit(UPDATE_HOME_USER_REFRESH, {
          slackUserId: user,
          slackTeamId: team_id,
        });
      }
      await sendOnboardingIfNeeded(onboardingManager, appOpenedEvent);
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
