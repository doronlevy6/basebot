import { SlackActionWrapper } from '../slack/types';
import { Message } from '@slack/web-api/dist/response/ConversationsRepliesResponse';
import { UserLink } from '../slack/components/user-link';
import axios from 'axios';

export const threadSummarizationHandler = async ({
  shortcut,
  ack,
  client,
  logger,
  payload,
}: SlackActionWrapper) => {
  try {
    await ack();

    const messageTs = payload.message.ts;
    const channelId = payload.channel.id;
    const messageReplies: Message[] = [];

    if (!payload.message.user && !payload.message['bot_id']) {
      throw new Error('cannot extract user from empty user');
    }

    logger.info(
      `${shortcut.user.id} requested a thread summarization on ${payload.message.ts} in channel ${payload.channel.id}`,
    );

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let cursor = '';
      const messageRepliesRes = await client.conversations.replies({
        channel: channelId,
        ts: messageTs,
        limit: 200,
        cursor: cursor,
      });

      if (messageRepliesRes.error) {
        throw new Error(`message replies error: ${messageRepliesRes.error}`);
      }
      if (!messageRepliesRes.ok) {
        throw new Error('message replies not ok');
      }

      if (!messageRepliesRes.messages) {
        break;
      }

      messageReplies.push(
        ...messageRepliesRes.messages.filter((m) => m.ts !== messageTs),
      );

      if (!messageRepliesRes.has_more) {
        break;
      }

      if (!messageRepliesRes.response_metadata?.next_cursor) {
        break;
      }
      cursor = messageRepliesRes.response_metadata.next_cursor;
    }

    const messagesWithText: (
      | Message
      | {
          type: 'message';
          user?: string;
          ts: string;
          text?: string;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          [key: string]: any;
        }
    )[] = [payload.message, ...messageReplies].filter((t) => t.text);

    const messagesTexts: string[] = messagesWithText.map(
      (m) => m.text,
    ) as string[];

    const messageUserIds: string[] = [
      ...new Set(messagesWithText.map((m) => m.user)),
    ].filter((u) => u) as string[];

    const messageBotIds: string[] = [
      ...new Set(messagesWithText.map((m) => m.bot_id)),
    ].filter((u) => u) as string[];

    const userInfoReses = await Promise.all(
      messageUserIds.map((u) => client.users.info({ user: u })),
    );

    const botInfoReses = await Promise.all(
      messageBotIds.map((u) => client.bots.info({ bot: u })),
    );

    const userNames = messagesWithText.map((m) => {
      const userInfo = userInfoReses.find((uir) => {
        if (uir.error) {
          throw new Error(`message user error: ${uir.error}`);
        }
        if (!uir.ok || !uir.user) {
          throw new Error('message user not ok');
        }

        return uir.user.id === m.user;
      });
      if (userInfo && userInfo.user) {
        return userInfo.user.name;
      }

      const botInfo = botInfoReses.find((uir) => {
        if (uir.error) {
          throw new Error(`message bot user error: ${uir.error}`);
        }
        if (!uir.ok || !uir.bot) {
          throw new Error('message bot user not ok');
        }

        return uir.bot.id === m.bot_id;
      });

      if (!botInfo || !botInfo.bot) {
        throw new Error(
          `no user information or bot information found for user ${
            m.user || m.bot_id
          }`,
        );
      }

      return botInfo.bot.name;
    }) as string[];

    logger.info(
      `Attempting to summarize thread with ${messagesTexts.length} messages and ${userNames.length} users`,
    );

    const modelRes = await axios.post(
      process.env.THREAD_SUMMARY_MODEL_URL as string,
      {
        messages: messagesTexts,
        names: userNames,
      },
      {
        timeout: 60000,
      },
    );

    if (modelRes.status >= 200 && modelRes.status <= 299) {
      await client.chat.postMessage({
        channel: shortcut.channel.id,
        text: `${UserLink(
          shortcut.user.id,
        )} requested a summary for this thread:\n\n${modelRes.data['data']}`,
        thread_ts: payload.message_ts,
        user: shortcut.user.id,
      });
    }
  } catch (error) {
    logger.error(error);
    await client.chat.postMessage({
      channel: shortcut.user.id,
      text: `We had an error processing the summarization: ${error.message}`,
      thread_ts: payload.message_ts,
      user: shortcut.user.id,
    });
  }
};
