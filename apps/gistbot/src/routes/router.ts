import { App } from '@slack/bolt';
import { AnalyticsManager } from '../analytics/manager';
import { addToChannelHandler } from '../slack/add-to-channel';
import { ThreadSummaryModel } from '../summaries/models/thread-summary.model';
import { threadSummarizationHandler } from '../summaries/thread-summarizer';
import { threadSummaryFeedbackHandler } from '../summaries/thread-summary-feedback';
import { slashCommandRouter } from './slash-command-router';

export enum Routes {
  SUMMARIZE_THREAD = 'summarize-thread',
  ADD_TO_CHANNEL_SUBMIT = 'add-to-channel-submit',
  THREAD_SUMMARY_FEEDBACK = 'thread-summary-feedback',
}

export const registerBoltAppRouter = (
  app: App,
  analyticsManager: AnalyticsManager,
  threadSummaryModel: ThreadSummaryModel,
) => {
  app.shortcut(
    Routes.SUMMARIZE_THREAD,
    threadSummarizationHandler(analyticsManager, threadSummaryModel),
  );
  app.view(Routes.ADD_TO_CHANNEL_SUBMIT, addToChannelHandler);
  app.command(/gist.*/, slashCommandRouter(threadSummaryModel));
  app.action(
    Routes.THREAD_SUMMARY_FEEDBACK,
    threadSummaryFeedbackHandler(analyticsManager),
  );

  // This is the global action handler, which will match all unmatched actions
  app.action(/.*/, onlyAck);

  // This is a general message event handler to log all received messages
  app.event('message', async ({ event, logger }) => {
    logger.info(event);
  });
};

const onlyAck = async ({ ack }) => {
  await ack();
};
