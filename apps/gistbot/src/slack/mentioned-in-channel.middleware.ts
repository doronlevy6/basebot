import {
  Context,
  GenericMessageEvent,
  Middleware,
  SlackEventMiddlewareArgs,
} from '@slack/bolt';
import { parseSlackMrkdwn } from './parser';

const PARSED_CHANNEL_MENTIONED_USERS_CONTEXT_KEY =
  'parsed_channel_mentioned_users';

export const getChannelMentionedUsersFromContext = (
  context: Context,
): string[] => {
  return context[PARSED_CHANNEL_MENTIONED_USERS_CONTEXT_KEY] || [];
};

export function mentionedInChannelMessage(): Middleware<
  SlackEventMiddlewareArgs<'message'>
> {
  return async ({ body, next, context }) => {
    const event = body.event as GenericMessageEvent;

    // If there's no text, then there's definitely no mention,
    // If event has thread_ts it is a thread replay not channel message,
    // so we skip the event entirely.
    if (!event.text || event.thread_ts || event.bot_id) {
      return;
    }

    const text = event.text.trim();
    const parsedMentions = parseSlackMrkdwn(text).sections.filter((s) => {
      return s.type === 'user_mention' && s.userId !== context.botUserId;
    });

    if (!parsedMentions || parsedMentions.length === 0) {
      return;
    }

    context[PARSED_CHANNEL_MENTIONED_USERS_CONTEXT_KEY] = parsedMentions.map(
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
