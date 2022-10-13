import {
  Context,
  GenericMessageEvent,
  Middleware,
  SlackEventMiddlewareArgs,
} from '@slack/bolt';
import { parseSlackMrkdwn } from './parser';

const PARSED_THREAD_MENTIONED_USERS_CONTEXT_KEY =
  'parsed_thread_mentioned_users';

export const getThreadMentionedUsersFromContext = (
  context: Context,
): string[] => {
  return context[PARSED_THREAD_MENTIONED_USERS_CONTEXT_KEY] || [];
};

export function mentionedInThreadMessage(): Middleware<
  SlackEventMiddlewareArgs<'message'>
> {
  return async ({ body, next, context }) => {
    const event = body.event as GenericMessageEvent;

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

    context[PARSED_THREAD_MENTIONED_USERS_CONTEXT_KEY] = parsedMentions.map(
      (pm) => {
        if (pm.type !== 'user_mention') {
          throw new Error(
            'undefined behaviour, non user_mention type after we should be filtered to only user_mention types',
          );
        }

        return pm.userId;
      },
    );

    await next();
  };
}
