import { App } from '@slack/bolt';
import { addToChannelHandler } from '../slack/add-to-channel';
import { channelSummarizationHandler } from '../summaries/channel-summarizer';
import { threadSummarizationHandler } from '../summaries/thread-summarizer';

export enum Routes {
  SUMMARIZE_THREAD = 'summarize-thread',
  ADD_TO_CHANNEL_SUBMIT = 'add-to-channel-submit',
  GIST_COMMAND = '/gist',
}

export const registerBoltAppRouter = (app: App) => {
  app.shortcut(Routes.SUMMARIZE_THREAD, threadSummarizationHandler);
  app.view(Routes.ADD_TO_CHANNEL_SUBMIT, addToChannelHandler);
  app.command(Routes.GIST_COMMAND, channelSummarizationHandler);

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
