import {
  GmailDigest,
  SlackIdToMailResponse,
  UserMetadata,
} from '../email-for-slack/types';

export interface IEmailRefreshMetadata {
  refreshing: boolean;
  error?: string;
  numEmails?: number;
}
export interface IShareToSlackMetaData {
  channels: string[];
  id: string;
  text?: string;
  userMetaData: Omit<UserMetadata, 'userId'>;
}
export interface IHomeState {
  gmailConnected?: Date;
  emailEnabled?: boolean;
  onBoardingMessage?: string;
  slackOnboarded: boolean;
  gmailDigest?: {
    digest: GmailDigest;
    lastUpdated: number;
  };
  gmailRefreshMetadata: IEmailRefreshMetadata;
}

export const UPDATE_HOME_EVENT_NAME = 'updateHome';
export const DISPLAY_ERROR_MODAL_EVENT_NAME = 'errorModal';
export const ON_MESSAGE_CLEARED_EVENT_NAME = 'onMessageCleared';
export const ON_MESSAGE_SHARED_EVENT_NAME = 'onMessageSharedEvent';
export type OnMessageClearedEvent = SlackIdToMailResponse & { id: string };
export const UPDATE_EMAIL_REFRESH_METADATA_EVENT_NAME = 'updateRefreshMetadata';
export const UPDATE_HOME_USER_REFRESH = 'userRefresh';
export type UpdateEmailRefreshMetadataEvent = SlackIdToMailResponse & {
  metadata: IEmailRefreshMetadata;
};
