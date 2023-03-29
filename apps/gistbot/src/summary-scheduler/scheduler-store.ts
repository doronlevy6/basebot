import { PgUtil, PgConfig } from '@base/utils';
import { UserSchedulerOptions, UserSchedulerSettings } from './types';

export interface SchedulerSettingsStore {
  saveUserSchedulerSettings(settings: UserSchedulerSettings): Promise<void>;
  fetchUsersSettingsInInterval(
    timeHour: number,
    limit?: number,
    offset?: number,
  ): Promise<UserSchedulerSettings[]>;
  fetchUserSettings(
    slackUserId: string,
    slackTeamId: string,
  ): Promise<UserSchedulerSettings | undefined>;
  disableSchedulerSettings(
    slackUserId: string,
    slackTeamId: string,
  ): Promise<void>;
}

export class PgSchedulerSettingsStore
  extends PgUtil
  implements SchedulerSettingsStore
{
  constructor(cfg: PgConfig) {
    super(cfg);
  }

  async synchronizeTables(): Promise<void> {
    await this.db
      .raw(`CREATE TABLE IF NOT EXISTS gistbot_user_scheduler_settings (
        slack_team_id varchar(36) NOT NULL,
        slack_user_id varchar(36) NOT NULL,
        enabled boolean default false,
        time_hour int NOT NULL,
        days int[] not null,
        channels jsonb NOT NULL,
        PRIMARY KEY ("slack_team_id", "slack_user_id")
      );

      alter table  gistbot_user_scheduler_settings 
      add column IF NOT EXISTS selected_hour int not null default ${Number(
        UserSchedulerOptions.MORNING,
      )};
    `);
  }

  async saveUserSchedulerSettings(
    settings: UserSchedulerSettings,
  ): Promise<void> {
    await this.db('gistbot_user_scheduler_settings')
      .insert({
        slack_team_id: settings.slackTeam,
        slack_user_id: settings.slackUser,
        enabled: settings.enabled,
        time_hour: settings.timeHour,
        days: settings.days,
        channels: JSON.stringify(settings.channels),
        selected_hour: settings.selectedHour,
      })
      .onConflict(['slack_team_id', 'slack_user_id'])
      .merge();
  }

  async disableSchedulerSettings(
    slackUserId: string,
    slackTeamId: string,
  ): Promise<void> {
    await this.db('gistbot_user_scheduler_settings')
      .update({
        enabled: false,
      })
      .where({
        slack_team_id: slackTeamId,
        slack_user_id: slackUserId,
      });
  }

  async fetchUserSettings(slackUserId: string, slackTeamId: string) {
    const res = await this.db
      .select('*')
      .from('gistbot_user_scheduler_settings')
      .where({ slack_team_id: slackTeamId, slack_user_id: slackUserId });

    if (!res || res.length == 0) {
      return;
    }

    const userSettings = new UserSchedulerSettings();
    userSettings.slackUser = res[0].slack_user_id;
    userSettings.slackTeam = res[0].slack_team_id;
    userSettings.enabled = res[0].enabled;
    userSettings.timeHour = res[0].time_hour;
    userSettings.days = res[0].days;
    userSettings.channels = res[0].channels;
    userSettings.selectedHour = res[0].selected_hour;
    return userSettings;
  }

  async fetchUsersSettingsInInterval(
    timeHour: number,
    limit?: number,
    offset?: number,
  ): Promise<UserSchedulerSettings[]> {
    const res = await this.db
      .select('*')
      .from('gistbot_user_scheduler_settings')
      .where({ enabled: true, time_hour: timeHour })
      .limit(limit || 100)
      .offset(offset || 0);

    if (!res || res.length == 0) {
      return [];
    }

    const resUsersSettings: UserSchedulerSettings[] = res.map((val) => {
      const userSettings = new UserSchedulerSettings();
      userSettings.slackTeam = val['slack_team_id'];
      userSettings.slackUser = val['slack_user_id'];
      userSettings.enabled = true;
      userSettings.timeHour = val['time_hour'];
      userSettings.days = val['days'];
      userSettings.channels = val['channels'];
      userSettings.selectedHour = val['selected_hour'];
      return userSettings;
    });

    return resUsersSettings;
  }
}
