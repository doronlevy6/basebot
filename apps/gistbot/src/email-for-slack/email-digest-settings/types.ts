export class CreateUsersSettingDto {
  userId: string;
  enabled: boolean;
  timeHour: number;
  days: number[];
  selectedHour: number;
}

export enum UserSchedulerOptions {
  ON = 'on',
  OFF = 'off',
  MORNING = '9',
  EVENING = '17',
}
