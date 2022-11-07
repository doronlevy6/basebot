export const JOB_MINUTES_INTERVAL = 10;
export const TIME_MINUTES_TO_LOCK = 180;
export const LIMIT = 100;

export class UserSchedulerSettings {
  slackTeam: string;
  slackUser: string;
  enabled: boolean;
  timeHour: number;
  days: number[];
  channels: { channelId: string; channelName: string }[];
}
