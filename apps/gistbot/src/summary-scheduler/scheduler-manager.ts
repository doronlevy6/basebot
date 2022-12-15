import { AnalyticsManager } from '@base/gistbot-shared';
import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { SchedulerSettingsStore } from './scheduler-store';
import { UserSchedulerOptions, UserSchedulerSettings } from './types';

export class SchedulerSettingsManager {
  constructor(
    private store: SchedulerSettingsStore,
    private analytics: AnalyticsManager,
  ) {}

  async saveUserSchedulerSettings(
    settings: UserSchedulerSettings,
  ): Promise<void> {
    this.analytics.scheduleSettingsSaved({
      slackUserId: settings.slackUser,
      slackTeamId: settings.slackTeam,
      scheduledTime: settings.timeHour.toString(),
      channelIds: settings.channels.map((c) => c.channelId),
    });
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

  async saveDefaultUserSchedulerSettings(
    client: WebClient,
    userId: string,
    teamId: string,
    selectedChannels: string[],
  ) {
    const usersettings = new UserSchedulerSettings();
    const prevSettings = await this.fetchUserSettings(userId, teamId);

    if (prevSettings) {
      return;
    }

    const userInfo = await client.users.info({ user: userId });
    if (
      !userInfo ||
      !userInfo.ok ||
      userInfo.error ||
      userInfo.user?.tz_offset === undefined
    ) {
      logger.error(
        `could not fetch user: ${userId} info to get timezone when saving default user settings`,
      );
      return;
    }

    usersettings.slackUser = userId;
    usersettings.slackTeam = teamId;
    usersettings.enabled = true;
    usersettings.timeHour = this.calculateUserDefaultHour(
      userInfo.user.tz_offset,
      Number(UserSchedulerOptions.MORNING),
    );
    usersettings.selectedHour = Number(UserSchedulerOptions.MORNING);
    usersettings.days = [0, 1, 2, 3, 4, 5, 6];

    const channelsInfos = await Promise.all(
      selectedChannels.map((c) => {
        return client.conversations.info({ channel: c });
      }),
    );

    for (const channelInfo of channelsInfos) {
      if (
        !channelInfo.ok ||
        channelInfo.error ||
        !channelInfo.channel?.id ||
        !channelInfo.channel?.name
      ) {
        logger.error(
          `error fetching channel info when saving default user settings`,
        );
        return;
      }
    }

    usersettings.channels = channelsInfos.map((channelInfo) => {
      return {
        channelId: channelInfo.channel?.id as string,
        channelName: channelInfo.channel?.name as string,
      };
    });
    await this.saveUserSchedulerSettings(usersettings);
  }

  calculateUserDefaultHour(offset: number, hour: number): number {
    const date = new Date();
    date.setUTCHours(hour, 0, 0);
    let defaultHour = date.getUTCHours() - Math.floor(offset / 3600);
    defaultHour = defaultHour % 24;
    if (defaultHour < 0) {
      defaultHour = 24 + defaultHour;
    }

    return defaultHour;
  }
}
