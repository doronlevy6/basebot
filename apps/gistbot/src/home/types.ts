import { GmailDigest, SlackIdToMailResponse } from '../email-for-slack/types';

export interface IEmailRefreshMetadata {
  refreshing: boolean;
  error?: string;
  numEmails?: number;
}
export interface IHomeState {
  gmailConnected?: Date;
  slackOnboarded: boolean;
  gmailDigest?: {
    digest: GmailDigest;
    lastUpdated: number;
  };
  gmailRefreshMetadata: IEmailRefreshMetadata;
}

export const UPDATE_HOME_EVENT_NAME = 'updateHome';
export const ON_MESSAGE_CLEARED_EVENT_NAME = 'onMessageCleared';
export type OnMessageClearedEvent = SlackIdToMailResponse & { id: string };
export const UPDATE_EMAIL_REFRESH_METADATA_EVENT_NAME = 'updateRefreshMetadata';
export type UpdateEmailRefreshMetadataEvent = SlackIdToMailResponse & {
  metadata: IEmailRefreshMetadata;
};
