export const MAIL_BOT_SERVICE_API = process.env.MAIL_BOT_SERVICE_API || '';

export enum JobsTypes {
  DIGEST = 'digest',
  ONBOARDING = 'onboarding',
  REFRESH_UPDATE = 'refresh_update',
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
  category: EmailCategory;
  id?: string;
  actions?: DigestAction[];
}

export class DigestMessage {
  id: string;
  actions: DigestAction[];
  title: string;
  timeStamp?: number;
  body: string;
  from: string;
  link?: string;
  relatedMails?: GmailMessage[];
  readMoreBody?: string;
  attachments?: DigestMailAttachments[];
}

export class DigestMailAttachments {
  type: 'pdf' | 'image' | 'other' | 'zip' | 'calendar';
  filename: string;
  link: string;
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
  Archive = 'archive',
  ArchiveAll = 'archiveAll',
}

export class Classification {
  type: EmailCategory;
  subtype: string;
  groupId?: string;
  score?: number;
}

export enum EmailCategory {
  Priority = 'Priority',
  Apps = 'Apps',
  Calendar = 'Calendar',
  Newsletters = 'Newsletters',
  Personal = 'Personal',
  Promotions = 'Promotions',
  Social = 'Social',
  DocSigning = 'Document-signing',
  Groups = 'Groups',
}

export const EmailCategoryToEmoji: Map<EmailCategory, string> = new Map([
  [EmailCategory.Priority, ':sparkles:'],
  [EmailCategory.Apps, ':iphone:'],
  [EmailCategory.Calendar, ':calendar:'],
  [EmailCategory.Newsletters, ':newspaper:'],
  [EmailCategory.Promotions, ':moneybag:'],
  [EmailCategory.Social, ':bowling:'],
  [EmailCategory.DocSigning, ':page_facing_up:'],
  [EmailCategory.Groups, ':people_holding_hands:'],
]);

export interface IHomeViewMetadata {
  userId: string;
  teamId: string;
  updatedAt: number;
}
