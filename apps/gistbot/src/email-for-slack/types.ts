import { gmail_v1 } from 'googleapis';

export class MessageResponseJob {
  metedata: UserMetadata;
  data: gmail_v1.Schema$Message[];
}

export class UserMetadata {
  userId: string;
  slackUserId: string;
  slackTeamId: string;
}
