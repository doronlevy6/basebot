export type Session = ChannelSummarySession | ThreadSummarySession;

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
