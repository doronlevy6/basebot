import { WebClient } from '@slack/web-api';
import { defaultParseTextOpts, parseSlackMrkdwn } from '../../slack/parser';
import { extractMessageText } from '../../slack/message-text';
import { SlackMessage } from '../types';
import { Message } from '@slack/web-api/dist/response/ConversationsRepliesResponse';
import {
  ModelMessage,
  ModelMessageReaction,
} from '../models/messages-summary.model';
import { filterUnwantedMessages } from '../utils';
import { SlackDataStore } from '../../utils/slack-data-store';

export interface PickedMessage
  extends Pick<
    ModelMessage,
    'ts' | 'thread_ts' | 'channel_id' | 'user_id' | 'reactions' | 'text'
  > {
  is_bot: boolean;
}

let userID: string;
let isBot: boolean;

export const parseModelMessage = async (
  message: SlackMessage | Message,
  client: WebClient,
  teamId: string,
  channelId: string,
  slackDataStore: SlackDataStore,
  myBotId?: string,
): Promise<PickedMessage | undefined> => {
  const messageIsOkay =
    (await extractMessageText(
      message,
      false,
      teamId,
      client,
      slackDataStore,
    )) && filterUnwantedMessages(message, myBotId);

  if (!messageIsOkay || !message.ts) {
    return;
  }

  const reactions = await extractReactions(message);

  const messageText = await parseSlackMrkdwn(
    await extractMessageText(message, false, teamId, client, slackDataStore),
  ).plainText(teamId, client, defaultParseTextOpts, slackDataStore);

  // if true this is a user
  if (message.user && !message['app_id']) {
    userID = message.user || message.bot_id || 'U0UNKNOWN';
    isBot = false;
  } else {
    userID = message.bot_id || message.user || 'U0UNKNOWN';
    isBot = Boolean(message.bot_id);
  }
  return {
    ts: message.ts,
    thread_ts: message.thread_ts || message.ts,
    channel_id: channelId,
    user_id: userID,
    reactions: reactions,
    text: messageText,
    is_bot: isBot,
  };
};
const extractReactions = async (
  message: SlackMessage | Message,
): Promise<ModelMessageReaction[]> => {
  if (!('reactions' in message)) {
    return [];
  }

  return (
    message.reactions?.map((reaction): ModelMessageReaction => {
      return {
        name: reaction.name || 'unknown-reaction',
        count: reaction.count || 0,
      };
    }) || []
  );
};

export const consolidateForRequest = (
  channelName: string,
  messages: PickedMessage[],
  userOrBotDetails: {
    name: string;
    title: string;
    id: string;
  }[],
): ModelMessage[] => {
  return messages.map((m): ModelMessage => {
    const userDetails = userOrBotDetails.find((u) => u.id === m.user_id);
    return {
      ts: m.ts,
      thread_ts: m.thread_ts,
      channel: channelName,
      channel_id: m.channel_id,
      user_id: m.user_id,
      user_name: userDetails?.name || 'Unknown User',
      user_title: userDetails?.title || '',
      reactions: m.reactions,
      text: m.text,
    };
  });
};
