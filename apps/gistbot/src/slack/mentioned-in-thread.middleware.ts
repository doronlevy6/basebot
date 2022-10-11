import {
  GenericMessageEvent,
  Middleware,
  SlackEventMiddlewareArgs,
} from '@slack/bolt';
import { parseSlackMrkdwn } from './parser';

export function mentionedInThreadMessage(): Middleware<
  SlackEventMiddlewareArgs<'message'>
> {
  return async ({ body, next, logger, context }) => {
    const event = body.event as GenericMessageEvent;
    logger.info(`${event.user} mentioned us in ${event.channel}`);

    // No thread_ts means skip because it's not a thread mention
    // so we skip the event entirely.
    if (!event.thread_ts) {
      return;
    }

    // If there's no text, then there's definitely no mention,
    // so we skip the event entirely.
    if (!event.text) {
      return;
    }

    const text = event.text.trim();
    const parsedMentions = parseSlackMrkdwn(text).sections.filter((s) => {
      return s.type === 'user_mention' && s.userId !== context.botUserId;
    });

    if (!parsedMentions || parsedMentions.length === 0) {
      return;
    }

    await next();
  };
}
