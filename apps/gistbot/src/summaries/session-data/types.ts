import { ModelMessage } from '../models/messages-summary.model';

export type Session =
  | ChannelSummarySession
  | ThreadSummarySession
  | MessagesSummarySession;

export interface ChannelSummarySession {
  summaryType: 'channel';
  teamId: string;
  channelId: string;
  requestingUserId: string;
  request: {
    channel_name: string;
    threads: {
      messageIds: string[];
      userIds: string[];
      reactions: number[];
    }[];
  };
  response: string;
}

export interface MessagesSummarySession {
  summaryType: 'channel' | 'thread';
  teamId: string;
  channelId: string;
  requestingUserId: string;
  messages: ModelMessage[];
  response: string;
}

export interface ThreadSummarySession {
  summaryType: 'thread';
  teamId: string;
  channelId: string;
  requestingUserId: string;
  threadTs: string;
  request: {
    channel_name: string;
    messageIds: string[];
    userIds: string[];
    reactions: number[];
  };
  response: string;
}
