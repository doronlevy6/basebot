import { logger } from '@base/logger';
import { AnalyticsManager } from '../analytics/manager';
import { Help } from '../slack/components/help';
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
    } = props;
    logger.info(`Running command ${text}`);

    if (text === 'help') {
      await props.ack();
      await respond({
        response_type: 'ephemeral',
        text: 'Hi there :wave:',
        blocks: Help(context.botUserId || ''),
      });
      return;
    }

    await handler(props);
  };
};
