import { WebClient } from '@slack/web-api';
import { parseSlackMrkdwn } from '../slack/parser';
import { extractMessageText } from '../slack/message-text';
import { SlackMessage } from './types';

const MAX_REPLIES_TO_FETCH = 20;

export const parseMessagesForSummary = async (
  messages: SlackMessage[],
  client: WebClient,
) => {
  const messagesWithText = messages?.filter((t) => extractMessageText(t));

  const messagesTexts: string[] = (await Promise.all(
    messagesWithText.map((m) =>
      parseSlackMrkdwn(extractMessageText(m)).plainText(client),
    ),
  )) as string[];

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
    if (userInfo && userInfo.user && userInfo.user.name) {
      const capitalizedName =
        userInfo.user.name.charAt(0).toUpperCase() +
        userInfo.user.name.slice(1);

      return capitalizedName;
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

    if (!botInfo || !botInfo.bot || !botInfo.bot.name) {
      throw new Error(
        `no user information or bot information found for user ${
          m.user || m.bot_id
        }`,
      );
    }

    const capitalizedName =
      botInfo.bot.name.charAt(0).toUpperCase() + botInfo.bot.name.slice(1);

    return capitalizedName;
  }) as string[];

  return {
    messages: messagesTexts,
    users: userNames,
  };
};

export const enrichWithReplies = async (
  channelId: string,
  messages: SlackMessage[],
  client: WebClient,
) => {
  const repliesPromises = messages.map((m) => {
    if (!m.reply_count || !m.ts) {
      return Promise.resolve([]);
    }

    return client.conversations
      .replies({
        channel: channelId,
        ts: m.ts,
        limit: MAX_REPLIES_TO_FETCH,
      })
      .then(({ messages }) => {
        if (!messages) {
          return [];
        }

        const repliesWithoutParent = messages.filter(
          (reply) => reply.ts !== m.ts,
        );
        return repliesWithoutParent;
      });
  });

  const replies = await Promise.all(repliesPromises);
  return replies.map((repliesArray, i) => ({
    message: messages[i],
    replies: repliesArray,
  }));
};
