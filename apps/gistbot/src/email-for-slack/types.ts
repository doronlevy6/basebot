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
  message?: string;
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
  to: string[];
  cc: string[];
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
  ReadMore = 'open',
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

export const EmailCategoryToName: Map<EmailCategory, string> = new Map([
  [EmailCategory.Priority, 'PRIORITY'],
  [EmailCategory.Apps, 'APPS'],
  [EmailCategory.Calendar, 'CALENDAR'],
  [EmailCategory.Newsletters, 'NEWSLETTERS'],
  [EmailCategory.Promotions, 'PROMOTIONS'],
  [EmailCategory.Social, 'SOCIAL'],
  [EmailCategory.DocSigning, 'DOCUMENT SIGNING'],
  [EmailCategory.Groups, 'GROUP MAIL'],
]);

export const EmailCategoryToEmoji: Map<EmailCategory, string> = new Map([
  [EmailCategory.Priority, ':sparkles:'],
  [EmailCategory.Apps, ':rocket:'],
  [EmailCategory.Calendar, ':calendar:'],
  [EmailCategory.Newsletters, ':newspaper:'],
  [EmailCategory.Promotions, ':moneybag:'],
  [EmailCategory.Social, ':bowling:'],
  [EmailCategory.DocSigning, ':page_facing_up:'],
  [EmailCategory.Groups, ':people_holding_hands:'],
]);

export enum ReplyOptions {
  Reply = 'Reply',
  ReplyAll = 'ReplyAll',
  Forward = 'Forward',
}

export interface IHomeViewMetadata {
  userId: string;
  teamId: string;
  updatedAt: number;
}

export type ResolveMailAction = Extract<
  DigestAction,
  | DigestAction.Archive
  | DigestAction.ArchiveAll
  | DigestAction.MarkAsRead
  | DigestAction.MarkAllAsRead
>;

interface ActionConfig {
  name: string;
  fullName: string;
  isBulkAction: boolean;
}
export const ResolveActionConfig: Record<ResolveMailAction, ActionConfig> = {
  [DigestAction.Archive]: {
    name: 'Archive',
    fullName: 'Archive',
    isBulkAction: false,
  },
  [DigestAction.ArchiveAll]: {
    name: 'Archive',
    fullName: 'Archive',
    isBulkAction: true,
  },
  [DigestAction.MarkAsRead]: {
    name: 'Mark as read',
    fullName: 'Mark as read',
    isBulkAction: false,
  },
  [DigestAction.MarkAllAsRead]: {
    name: 'Mark as read',
    fullName: 'Mark as read',
    isBulkAction: true,
  },
};
