import { App } from '@slack/bolt';
import { threadSummarizationHandler } from '../summaries/thread-summarizer';

export enum Routes {
  SUMMARIZE_THREAD = 'summarize-thread',
}

export const registerBoltAppRouter = (app: App) => {
  app.shortcut(Routes.SUMMARIZE_THREAD, threadSummarizationHandler);

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
