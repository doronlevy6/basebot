import { SchedulerSettingsStore } from './scheduler-store';
import { UserSchedulerSettings } from './types';

export class SchedulerSettingsManager {
  constructor(private store: SchedulerSettingsStore) {}

  async saveUserSchedulerSettings(
    settings: UserSchedulerSettings,
  ): Promise<void> {
    return this.store.saveUserSchedulerSettings(settings);
  }

  async fetchUserSettings(slackUserId: string, slackTeamId: string) {
    return this.store.fetchUserSettings(slackUserId, slackTeamId);
  }

  async fetchUsersSettingsInInterval(
    timeHour: number,
    limit?: number,
    offset?: number,
  ): Promise<UserSchedulerSettings[]> {
    return this.store.fetchUsersSettingsInInterval(timeHour, limit, offset);
  }
}
