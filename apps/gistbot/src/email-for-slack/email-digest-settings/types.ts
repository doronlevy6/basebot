export interface IAuthenticationMetadata {
  slackUserId: string;
  slackTeamId: string;
}

export class EmailDigestUsersSettingsEntity {
  userId: string;
  enabled: boolean;
  timeHour: number;
  days: number[];
  selectedHour: number;
  workMode: EmailWorkMode;
  timeFrame: number;
  emailSettings?: { email: string; index: number }[];
}

export enum EmailSchedulerOptions {
  ON = 'on',
  OFF = 'off',
  MORNING = '9',
  EVENING = '17',
}
export enum EmailWorkMode {
  Archive = 'archive',
  MarkAsRead = 'mark_as_read',
}
export const DEFAULT_EMAIL_DIGEST_DAYS = [0, 1, 2, 3, 4, 5, 6];
