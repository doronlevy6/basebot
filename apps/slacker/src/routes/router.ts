import { Publisher } from '@base/pubsub';
import { App } from '@slack/bolt';
import { forwardingToPublisherMiddleware } from './forwarding-to-publisher-middleware';

export const registerBoltAppRouter = (
  app: App,
  publisher: Publisher,
  slackEventsQueueName: string,
) => {
  // This is the acking app, so we have global handlers for all of the types (events, shortcuts, actions, views, and slash commands).
  // The global handlers are simply here to register the listeners on the app, the actually never get called since the middleware will ack
  // and return without calling the next() function.

  app.use(forwardingToPublisherMiddleware(slackEventsQueueName, publisher));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.action(/.*/, async (_args) => {
    return;
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.view(/.*/, async (_args) => {
    return;
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.command(/.*/, async (_args) => {
    return;
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.shortcut(/.*/, async (_args) => {
    return;
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.options(/.*/, async (_args) => {
    return;
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.event(/.*/, async (_args) => {
    return;
  });
};
