import { gmail_v1 } from 'googleapis';

export enum JobsTypes {
  DIGEST = 'digest',
  ONBOARDING = 'onboarding',
}

export class MessageResponse {
  metedata: UserMetadata;
  data: gmail_v1.Schema$Message[];
}

export class UserMetadata {
  userId: string;
  slackUserId: string;
  slackTeamId: string;
}

export class SlackIdToMailResponse {
  email: string;
  slackUserId: string;
  slackTeamId: string;
}
