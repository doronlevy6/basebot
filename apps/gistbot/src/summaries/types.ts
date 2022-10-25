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
