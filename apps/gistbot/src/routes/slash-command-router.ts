import { logger } from '@base/logger';
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
import { chatHandler } from '../experimental/chat/handler';
import { ChatModel } from '../experimental/chat/chat.model';

export const slashCommandRouter = (
  channelSummarizer: ChannelSummarizer,
  analyticsManager: AnalyticsManager,
  featureRateLimiter: FeatureRateLimiter,
  schedulerSettingsMgr: SchedulerSettingsManager,
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

  const chatModel = new ChatModel();
  const chatMessagesHandler = chatHandler(analyticsManager, chatModel);

  return async (props: SlackSlashCommandWrapper) => {
    const {
      command: { text },
      respond,
      context,
      client,
      body: { channel_id, user_id, team_id },
    } = props;
    logger.info(`Running command ${text}`);

    if (text === 'help') {
      await props.ack();
      await responder(
        respond,
        client,
        'Hi there :wave:',
        Help(props.command.user_id, context.botUserId || ''),
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
      await chatMessagesHandler(props);
      return;
    }

    await handler(props);
  };
};
