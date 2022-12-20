import { AnalyticsManager } from '@base/gistbot-shared';
import { Feature } from '../feature-rate-limiter/limits';
import { FeatureRateLimiter } from '../feature-rate-limiter/rate-limiter';
import { Help } from '../slack/components/help';
import { responder } from '../slack/responder';
import { SlackSlashCommandWrapper } from '../slack/types';
import { isBaseTeamWorkspace, isItayOnLenny } from '../slack/utils';
import { channelSummarizationHandler } from '../summaries/channel-handler';
import { ChannelSummarizer } from '../summaries/channel/channel-summarizer';
import { summarySchedularSettingsButtonHandler } from '../summary-scheduler/handler';
import { SchedulerSettingsManager } from '../summary-scheduler/scheduler-manager';
import { ChatManager } from '../experimental/chat/manager';

export const slashCommandRouter = (
  channelSummarizer: ChannelSummarizer,
  analyticsManager: AnalyticsManager,
  featureRateLimiter: FeatureRateLimiter,
  schedulerSettingsMgr: SchedulerSettingsManager,
  chatManager: ChatManager,
) => {
  const handler = channelSummarizationHandler(
    analyticsManager,
    channelSummarizer,
    schedulerSettingsMgr,
  );

  const summarySchedulerSettings = summarySchedularSettingsButtonHandler(
    schedulerSettingsMgr,
    analyticsManager,
  );

  return async (props: SlackSlashCommandWrapper) => {
    const {
      command: { text },
      respond,
      client,
      logger,
      body: { channel_id, user_id, team_id },
    } = props;
    logger.info(`Running command ${text}`);

    if (text === 'help') {
      await props.ack();
      await responder(
        respond,
        client,
        'Hi there :wave:',
        Help(props.command.user_id),
        channel_id,
        user_id,
        { response_type: 'ephemeral' },
      );
      return;
    }

    if (
      text === 'allow more' &&
      (isBaseTeamWorkspace(team_id) || isItayOnLenny(user_id, team_id))
    ) {
      await props.ack();
      logger.info(
        `${user_id} on team ${team_id} is requesting more for their rate limit`,
      );
      await Promise.all(
        Object.values(Feature).map((f) => {
          // Instead of awaiting internally we are using Promise.all and awaiting on the whole list here.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          featureRateLimiter.allowMore(
            { teamId: team_id, userId: user_id },
            f,
            5,
          );
        }),
      );
      return;
    }

    if (text === 'settings') {
      await summarySchedulerSettings(props);
      return;
    }

    if (text === 'chat' && isBaseTeamWorkspace(team_id)) {
      logger.info(`Handling chat command`);
      await chatManager.handleChatMessage({
        logger,
        client,
        userId: user_id,
        channelId: channel_id,
        teamId: team_id,
      });
      return;
    }

    await handler(props);
  };
};
