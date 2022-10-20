import { logger } from '@base/logger';
import { AnalyticsManager } from '../analytics/manager';
import { Help } from '../slack/components/help';
import { responder } from '../slack/responder';
import { SlackSlashCommandWrapper } from '../slack/types';
import { channelSummarizationHandler } from '../summaries/channel-handler';
import { ChannelSummarizer } from '../summaries/channel/channel-summarizer';

export const slashCommandRouter = (
  channelSummarizer: ChannelSummarizer,
  analyticsManager: AnalyticsManager,
) => {
  const handler = channelSummarizationHandler(
    analyticsManager,
    channelSummarizer,
  );

  return async (props: SlackSlashCommandWrapper) => {
    const {
      command: { text },
      respond,
      context,
      client,
      body: { channel_id, user_id },
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

    await handler(props);
  };
};
