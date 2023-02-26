import { GmailDigest, SlackIdToMailResponse } from '../email-for-slack/types';

export interface IHomeState {
  gmailConnected?: Date;
  slackOnboarded: boolean;
  gmailDigest?: {
    digest: GmailDigest;
    lastUpdated: number;
  };
}

export const UPDATE_HOME_EVENT_NAME = 'updateHome';
export const ON_MESSAGE_CLEARED_EVENT_NAME = 'onMessageCleared';
export type OnMessageClearedEvent = SlackIdToMailResponse & { id: string };
