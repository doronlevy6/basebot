export const MAIL_BOT_SERVICE_API = process.env.MAIL_BOT_SERVICE_API || '';

export enum JobsTypes {
  DIGEST = 'digest',
  ONBOARDING = 'onboarding',
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

export class GmailDigest {
  metedata: UserMetadata;
  sections: GmailDigestSection[];
}

export class GmailDigestSection {
  title: string;
  messages: DigestMessage[];
}

export class DigestMessage {
  id: string;
  actions: DigestAction[];
  title: string;
  timeStamp?: string;
  body: string;
  from: string;
  link?: string;
  relatedMails?: GmailMessage[];
  readMoreBody?: string;
}

export class GmailMessage {
  id: string;
  subject: string;
  snippet: string;
  from: string;
  to: string;
  link: string;
  classifications: Classification[];
}

export enum DigestAction {
  MarkAsRead = 'markAsRead',
  Reply = 'reply',
  MarkAllAsRead = 'markAllAsRead',
  RSVP = 'rsvp',
  ReadMore = 'readMore',
}

export class Classification {
  type: EmailCategory;
  subtype: string;
  groupId?: string;
  score?: number;
}

export enum EmailCategory {
  Apps = 'apps',
  Calendar = 'calendar',
  Newsletters = 'newsletters',
  Personal = 'personal',
  Promotions = 'promotions',
  Social = 'social',
  Other = 'other',
}
