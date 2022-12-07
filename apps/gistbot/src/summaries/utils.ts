import { BotsInfoResponse, WebClient } from '@slack/web-api';
import { defaultParseTextOpts, parseSlackMrkdwn } from '../slack/parser';
import { extractMessageText } from '../slack/message-text';
import { SlackMessage, TriggerContext } from './types';
import { approximatePromptCharacterCount } from './models/prompt-character-calculator';
import { logger } from '@base/logger';
import { DEFAULT_DAYS_BACK } from './channel/channel-summarizer';
import { RespondFn } from '@slack/bolt';
import { responder } from '../slack/responder';

const MAX_REPLIES_TO_FETCH = 200;

export const parseThreadForSummary = async (
  messages: SlackMessage[],
  client: WebClient,
  teamId: string,
  maxCharacterCountPerThread: number,
  channelName: string,
  myBotId?: string,
) => {
  const extractedMessagesTexts = await Promise.all(
    messages.map((m) => {
      return extractMessageText(m, false, teamId, client);
    }),
  );
  const messagesWithText = messages
    ?.filter((t, idx) => {
      return extractedMessagesTexts[idx] && filterUnwantedMessages(t, myBotId);
    })
    .map((m) => {
      return { message: m, messageId: m.ts as string }; // The message.ts value should never be undefined... Can we find instances where it is in order to ensure we filter them out?
    });

  const reactions = messagesWithText
    .map((m) => m.message.reactions || [])
    .map((reactions) =>
      reactions.reduce((acc, cur) => acc + (cur.count || 0), 0),
    );

  const extractedTransformed = await Promise.all(
    messagesWithText.map((m) =>
      extractMessageText(m.message, true, teamId, client),
    ),
  );
  const messagesTexts: string[] = (await Promise.all(
    extractedTransformed.map((m) =>
      parseSlackMrkdwn(m).plainText(teamId, client, defaultParseTextOpts),
    ),
  )) as string[];

  const messageUserIds: string[] = [
    ...new Set(messagesWithText.map((m) => m.message.user)),
  ].filter((u) => u) as string[];

  const messageBotIds: string[] = [
    ...new Set(messagesWithText.map((m) => m.message.bot_id)),
  ].filter((u) => u) as string[];

  const userInfoReses = await Promise.all(
    messageUserIds.map((u) =>
      client.users.profile
        .get({ user: u })
        .then((res) => {
          if (res.error) {
            throw new Error(`message user error: ${res.error}`);
          }
          if (!res.ok || !res.profile) {
            throw new Error('message user not ok');
          }

          return { ...res.profile, id: u };
        })
        .catch((reason) => {
          logger.error(
            `failed to get user info for user ${u} on team ${teamId}: ${reason}`,
          );

          return {
            id: u,
            display_name: 'Unknown User',
            real_name: undefined,
            first_name: undefined,
            title: undefined,
          };
        }),
    ),
  );

  const botInfoReses = await Promise.all(
    messageBotIds.map((u) =>
      client.bots.info({ bot: u, team_id: teamId }).catch((reason) => {
        logger.error(
          `failed to get bot info for bot ${u} on team ${teamId}: ${reason}`,
        );
        return {
          bot: { bot_id: u, name: 'Unknown Bot' },
          ok: true,
        } as BotsInfoResponse;
      }),
    ),
  );

  const userNamesAndTitles = messagesWithText.map((m) => {
    const userProfile = userInfoReses.find((uir) => {
      return uir.id === m.message.user;
    });
    if (userProfile) {
      const name =
        userProfile.display_name ||
        userProfile.real_name ||
        userProfile.first_name;
      if (name) {
        const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

        return {
          name: capitalizedName,
          title: userProfile.title || '',
          id: m.message.user || 'unknown',
        };
      }
    }

    const botInfo = botInfoReses.find((uir) => {
      if (uir.error) {
        throw new Error(`message bot user error: ${uir.error}`);
      }
      if (!uir.ok || !uir.bot) {
        throw new Error('message bot user not ok');
      }

      return uir.bot.id === m.message.bot_id;
    });

    if (!botInfo || !botInfo.bot || !botInfo.bot.name) {
      logger.error(
        `no user information or bot information found for user ${
          m.message.user || m.message.bot_id
        }`,
      );
      return { name: 'Unknown User', title: '', id: 'unknown' };
    }

    const capitalizedName =
      botInfo.bot.name.charAt(0).toUpperCase() + botInfo.bot.name.slice(1);

    return {
      name: capitalizedName,
      title: 'Bot',
      id: m.message.bot_id || 'unknown',
    };
  }) as { name: string; title: 'Bot' | string; id: string }[];

  let cc = approximatePromptCharacterCount({
    messages: messagesTexts,
    names: userNamesAndTitles.map((u) => u.name),
    titles: userNamesAndTitles.map((u) => u.title),
    channel_name: channelName,
    reactions: reactions,
  });
  while (cc > maxCharacterCountPerThread) {
    messagesWithText.shift();
    messagesTexts.shift();
    userNamesAndTitles.shift();
    reactions.shift();
    cc = approximatePromptCharacterCount({
      messages: messagesTexts,
      names: userNamesAndTitles.map((u) => u.name),
      titles: userNamesAndTitles.map((u) => u.title),
      channel_name: channelName,
      reactions: reactions,
    });
  }

  return {
    messageIds: messagesWithText.map((m) => m.messageId),
    messages: messagesTexts,
    users: userNamesAndTitles.map((u) => u.name),
    userIds: userNamesAndTitles.map((u) => u.id),
    reactions: reactions,
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

const filterInternalBotIds = [
  'B042VQMGZ55',
  'B043CMTLDFE',
  'B043CDNE604',
  'B043ZVCGLC8',
  'B045009QXT9',
];

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
  {
    channel,
    user,
    thread_ts,
    trigger_context,
    daysBack,
  }: {
    channel: string;
    user: string;
    thread_ts?: string;
    trigger_context?: TriggerContext;
    daysBack?: number;
  },
) => {
  const text = getInProgressText(daysBack);
  await client.chat.postEphemeral({
    thread_ts,
    response_type: 'ephemeral',
    channel: trigger_context === 'in_dm' ? user : channel,
    text,
    user,
  });
};

export const getInProgressText = (daysBack?: number) => {
  if (!daysBack) {
    return `Creating your summary`;
  }
  if (daysBack === 1) {
    return 'Creating a summary of your last day';
  }
  if (daysBack === 7) {
    return `Creating a summary of your last week`;
  }
  return `Creating a summary of your last ${daysBack} days`;
};

export const extractDaysBack = (text: string): number => {
  if (!text) {
    return DEFAULT_DAYS_BACK;
  }

  let daysMultiplier = 1;
  let extracted = '';

  if (text.endsWith(' days') || text.endsWith(' day')) {
    extracted = text.replace(' days', '').replace(' day', '');
    daysMultiplier = 1;
  }

  if (text.endsWith(' weeks') || text.endsWith(' week')) {
    extracted = text.replace(' weeks', '').replace(' week', '');
    daysMultiplier = 7;
  }

  if (!extracted) {
    return DEFAULT_DAYS_BACK;
  }

  try {
    const parsed = parseInt(extracted, 10);
    if (isNaN(parsed)) {
      return DEFAULT_DAYS_BACK;
    }
    return parsed * daysMultiplier;
  } catch (error) {
    logger.error(`error in parsing days back: ${error}`);
  }

  return DEFAULT_DAYS_BACK;
};

export const genericErrorMessage = async (
  userId: string,
  channelId: string,
  client: WebClient,
  threadTs?: string,
  respond?: RespondFn,
) => {
  try {
    await responder(
      respond,
      client,
      `Something went wrong, sorry! Please try again in 5 minutes`,
      undefined,
      channelId,
      userId,
      {
        response_type: 'ephemeral',
      },
      threadTs,
    );
  } catch (error) {
    logger.error(
      `error in generic error message response: ${error} ${error.stack}`,
    );
  }
};

export const getUserOrBotDetails = async (
  userOrBotIds: { user_id: string; is_bot: boolean }[],
  teamId: string,
  client: WebClient,
): Promise<
  {
    name: string;
    title: string;
    id: string;
  }[]
> => {
  return Promise.all(
    userOrBotIds.map((u) => {
      if (u.is_bot) {
        return client.bots
          .info({ bot: u.user_id, team_id: teamId })
          .catch((reason) => {
            logger.error(
              `failed to get bot info for bot ${u.user_id} on team ${teamId}: ${reason}`,
            );
            return {
              bot: { bot_id: u, name: 'Unknown Bot' },
              ok: true,
            } as BotsInfoResponse;
          })
          .then((bir) => {
            if (!bir.bot?.name) {
              return {
                name: 'Unknown Bot',
                title: 'Bot',
                id: u.user_id,
              };
            }

            const capitalizedName =
              bir.bot.name.charAt(0).toUpperCase() + bir.bot.name.slice(1);

            return {
              name: capitalizedName,
              title: 'Bot',
              id: u.user_id,
            };
          });
      }

      return client.users.profile
        .get({ user: u.user_id })
        .then((res) => {
          if (res.error) {
            throw new Error(`message user error: ${res.error}`);
          }
          if (!res.ok || !res.profile) {
            throw new Error('message user not ok');
          }

          const name =
            res.profile.display_name ||
            res.profile.real_name ||
            res.profile.first_name ||
            'Unknown User';

          const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

          return {
            name: capitalizedName,
            title: res.profile.title || '',
            id: u.user_id,
          };
        })
        .catch((reason) => {
          logger.error(
            `failed to get user info for user ${u.user_id} on team ${teamId}: ${reason}`,
          );

          return { name: 'Unknown User', title: '', id: u.user_id };
        });
    }),
  );
};
