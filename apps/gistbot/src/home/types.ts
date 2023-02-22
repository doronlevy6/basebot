import { GmailDigest } from '../email-for-slack/types';

export interface IHomeState {
  gmailConnected: boolean;
  slackOnboarded: boolean;
  gmailDigest?: {
    digest: GmailDigest;
    lastUpdated: number;
  };
}

export const UPDATE_HOME_EVENT_NAME = 'updateHome';
