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
>;
