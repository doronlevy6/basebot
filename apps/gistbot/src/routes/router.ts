import { App } from '@slack/bolt';
import { addToChannelHandler } from '../slack/add-to-channel';
import { threadSummarizationHandler } from '../summaries/thread-summarizer';
import { slashCommandRouter } from './slash-command-router';

export enum Routes {
  SUMMARIZE_THREAD = 'summarize-thread',
  ADD_TO_CHANNEL_SUBMIT = 'add-to-channel-submit',
}

export const registerBoltAppRouter = (app: App) => {
  app.shortcut(Routes.SUMMARIZE_THREAD, threadSummarizationHandler);
  app.view(Routes.ADD_TO_CHANNEL_SUBMIT, addToChannelHandler);
  app.command(/gist.*/, slashCommandRouter);

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
