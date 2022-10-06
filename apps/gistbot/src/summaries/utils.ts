import { WebClient } from '@slack/web-api';
import { parseSlackMrkdwn } from '../slack/parser';
import { extractMessageText } from '../slack/message-text';
import { SlackMessage } from './types';
import { approximatePromptCharacterCount } from './models/prompt-character-calculator';

const MAX_REPLIES_TO_FETCH = 200;

export const parseThreadForSummary = async (
  messages: SlackMessage[],
  client: WebClient,
  teamId: string,
  maxCharacterCountPerThread: number,
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
    messageUserIds.map((u) =>
      client.users.profile.get({ user: u }).then((res) => {
        if (res.error) {
          throw new Error(`message user error: ${res.error}`);
        }
        if (!res.ok || !res.profile) {
          throw new Error('message user not ok');
        }

        return { ...res.profile, id: u };
      }),
    ),
  );

  const botInfoReses = await Promise.all(
    messageBotIds.map((u) => client.bots.info({ bot: u, team_id: teamId })),
  );

  const userNamesAndTitles = messagesWithText.map((m) => {
    const userProfile = userInfoReses.find((uir) => {
      return uir.id === m.user;
    });
    if (userProfile) {
      const name =
        userProfile.display_name ||
        userProfile.real_name ||
        userProfile.first_name;
      if (name) {
        const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

        return { name: capitalizedName, title: userProfile.title || '' };
      }
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

    return { name: capitalizedName, title: 'Bot' };
  }) as { name: string; title: 'Bot' | string }[];

  let cc = approximatePromptCharacterCount({
    messages: messagesTexts,
    names: userNamesAndTitles.map((u) => u.name),
    titles: userNamesAndTitles.map((u) => u.title),
  });
  while (cc > maxCharacterCountPerThread) {
    messagesTexts.shift();
    userNamesAndTitles.shift();
    cc = approximatePromptCharacterCount({
      messages: messagesTexts,
      names: userNamesAndTitles.map((u) => u.name),
      titles: userNamesAndTitles.map((u) => u.title),
    });
  }

  return {
    messages: messagesTexts,
    users: userNamesAndTitles.map((u) => u.name),
    // TODO: Return the user titles back when they are used in personalization,
    // for now they are taking up space in the available tokens and are not exactly used in the model itself.
    // titles: userNamesAndTitles.map((u) => u.title),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    titles: userNamesAndTitles.map((u) => ''),
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

export const summaryInProgressMessage = async (
  client: WebClient,
  channel: string,
  user: string,
  message_ts?: string,
) => {
  await client.chat.postEphemeral({
    thread_ts: message_ts,
    response_type: 'ephemeral',
    channel: channel,
    text: `Creating your summary`,
    user: user,
  });
};
