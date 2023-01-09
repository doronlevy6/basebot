import { Message } from '@slack/web-api/dist/response/ChannelsHistoryResponse';
import { Message as ReplyMessage } from '@slack/web-api/dist/response/ChannelsRepliesResponse';

export type SlackMessage = Pick<
  Message & ReplyMessage,
  | 'ts'
  | 'thread_ts'
  | 'blocks'
  | 'user'
  | 'bot_id'
  | 'reply_count'
  | 'attachments'
  | 'text'
  | 'subtype'
  | 'reactions'
  | 'bot_profile'
  | 'root'
>;

export type TriggerContext = 'in_channel' | 'in_dm';

export type SummarizationProps =
  | ThreadSummarizationProps
  | ChannelSummarizationProps;

export interface ThreadSummarizationProps {
  type: 'thread';
  channelId: string;
  channelName: string;
  threadTs: string;
}

export interface ChannelSummarizationProps {
  type: 'channel';
  channelId: string;
  channelName: string;
}

export interface MultiChannelSummarizationProps {
  type: 'multi_channel';
  channels: {
    channelId: string;
    channelName: string;
  }[];
}

export type MultiChannelSummaryContext =
  | 'subscription'
  | 'global_shortcut'
  | 'mention_manually';

export type ChannelSummaryContext =
  | 'onboarding'
  | 'add_to_channel'
  | 'slash_command'
  | 'channel_join'
  | 'request_more_time'
  | 'bot_mentioned'
  | 'user_mentioned';
