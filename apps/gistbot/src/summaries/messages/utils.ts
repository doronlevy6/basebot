import { WebClient } from '@slack/web-api';
import { parseSlackMrkdwn } from '../../slack/parser';
import { extractMessageText } from '../../slack/message-text';
import { SlackMessage } from '../types';
import { Message } from '@slack/web-api/dist/response/ConversationsRepliesResponse';
import {
  ModelMessage,
  ModelMessageReaction,
} from '../models/messages-summary.model';
import { filterUnwantedMessages } from '../utils';

export interface PickedMessage
  extends Pick<
    ModelMessage,
    'ts' | 'thread_ts' | 'channel_id' | 'user_id' | 'reactions' | 'text'
  > {
  is_bot: boolean;
}

export const parseModelMessage = async (
  message: SlackMessage | Message,
  client: WebClient,
  teamId: string,
  channelId: string,
  myBotId?: string,
): Promise<PickedMessage | undefined> => {
  const messageIsOkay =
    extractMessageText(message, false) &&
    filterUnwantedMessages(message, myBotId);

  if (!messageIsOkay || !message.ts) {
    return;
  }

  const reactions = await extractReactions(message);

  const messageText = await parseSlackMrkdwn(
    extractMessageText(message, true),
  ).plainText(teamId, client, {
    removeCodeblocks: true,
    stripUnlabelsUrls: true,
    unlabeledUrlReplacement: '<LINK>',
  });

  return {
    ts: message.ts,
    thread_ts: message.thread_ts || message.ts,
    channel_id: channelId,
    user_id: message.bot_id || message.user || 'U0UNKNOWN',
    reactions: reactions,
    text: messageText,
    is_bot: Boolean(message.bot_id),
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
