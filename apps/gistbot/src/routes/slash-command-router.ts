import { logger } from '@base/logger';
import { AnalyticsManager } from '../analytics/manager';
import { respondWithHelp } from '../slack/help-message';
import { SlackSlashCommandWrapper } from '../slack/types';
import { channelSummarizationHandler } from '../summaries/channel-summarizer';
import { ThreadSummaryModel } from '../summaries/models/thread-summary.model';

export const slashCommandRouter = (
  threadSummaryModel: ThreadSummaryModel,
  analyticsManager: AnalyticsManager,
) => {
  const handler = channelSummarizationHandler(
    threadSummaryModel,
    analyticsManager,
  );

  return async (props: SlackSlashCommandWrapper) => {
    const {
      command: { text },
      respond,
    } = props;
    logger.info(`Running command ${text}`);

    if (text === 'help') {
      await props.ack();
      await respondWithHelp(respond);
      return;
    }

    await handler(props);
  };
};
