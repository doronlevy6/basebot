import { WebClient } from '@slack/web-api';
import { parseSlackMrkdwn } from '../slack/parser';
import { extractMessageText } from '../slack/message-text';
import { SlackMessage } from './types';
import {
  approximatePromptCharacterCount,
  MAX_PROMPT_CHARACTER_COUNT,
} from './models/prompt-character-calculator';
import { AnalyticsManager } from '../analytics/manager';
import { logger } from '@base/logger';

const MAX_REPLIES_TO_FETCH = 20;

export const parseMessagesForSummary = async (
  messages: SlackMessage[],
  client: WebClient,
  teamId: string,
  myBotId?: string,
) => {
  const messagesWithText = messages?.filter((t) => {
    return extractMessageText(t) && filterUnwantedMessages(t, myBotId);
  });

  const messagesTexts: string[] = (await Promise.all(
    messagesWithText.map((m) =>
      parseSlackMrkdwn(extractMessageText(m)).plainText(teamId, client),
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
    messageBotIds.map((u) => client.bots.info({ bot: u, team_id: teamId })),
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

  let cc = approximatePromptCharacterCount({
    messages: messagesTexts,
    names: userNames,
    titles: [],
  });
  while (cc > MAX_PROMPT_CHARACTER_COUNT) {
    messagesTexts.shift();
    userNames.shift();
    cc = approximatePromptCharacterCount({
      messages: messagesTexts,
      names: userNames,
      titles: [],
    });
  }

  return {
    messages: messagesTexts,
    users: userNames,
  };
};

export const enrichWithReplies = async (
  channelId: string,
  messages: SlackMessage[],
  client: WebClient,
  myBotId?: string,
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

        const repliesWithoutParent = messages.filter((reply) => {
          return reply.ts !== m.ts && filterUnwantedMessages(reply, myBotId);
        });
        return repliesWithoutParent;
      });
  });

  const replies = await Promise.all(repliesPromises);
  return replies.map((repliesArray, i) => ({
    message: messages[i],
    replies: repliesArray,
  }));
};

export const sortSlackMessages = (m1: SlackMessage, m2: SlackMessage) => {
  if ((m1.ts as string) < (m2.ts as string)) {
    return -1;
  }
  if ((m2.ts as string) < (m1.ts as string)) {
    return 1;
  }
  return 0;
};

const filteredSubtypes = [
  'channel_join',
  'channel_leave',
  'channel_topic',
  'channel_purpose',
  'channel_name',
  'channel_archive',
  'channel_unarchive',
];

const baseProductionBotId = 'B042VQMGZ55';
const stagingBotId = 'B043CMTLDFE';
const devBotId = 'B043CDNE604';

const filterInternalBotIds = [baseProductionBotId, stagingBotId, devBotId];

export const filterUnwantedMessages = (m: SlackMessage, myBotId?: string) => {
  if (m.subtype && filteredSubtypes.includes(m.subtype)) {
    return false;
  }

  if (m.bot_id && m.bot_id === myBotId) {
    return false;
  }

  if (m.bot_id && filterInternalBotIds.includes(m.bot_id)) {
    return false;
  }

  return true;
};

export const identifyTriggeringUser = async (
  userId: string,
  teamId: string,
  client: WebClient,
  analyticsManager: AnalyticsManager,
) => {
  try {
    const { error, ok, profile } = await client.users.profile.get({
      user: userId,
    });
    if (error || !ok) {
      throw new Error(`Failed to fetch user profile ${error}`);
    }

    if (!profile) {
      throw new Error(`Failed to fetch user profile profile not found`);
    }

    analyticsManager.identifyUser({
      slackUserId: userId,
      slackTeamId: teamId,
      username: profile.display_name,
      realName: profile.real_name,
      avatarUrl: profile.image_512,
    });
  } catch (error) {
    logger.error({
      msg: `failed to identify triggering user with error`,
      error: `${error.stack ? error.stack : error}`,
      userId: userId,
      teamId: teamId,
    });
  }
};
