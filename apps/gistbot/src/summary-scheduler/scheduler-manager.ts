import { AnalyticsManager } from '@base/gistbot-shared';
import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { SchedulerSettingsStore } from './scheduler-store';
import { UserSchedulerOptions, UserSchedulerSettings } from './types';
import { SlackDataStore } from '../utils/slack-data-store';
import { calculateUserDefaultHour } from '../utils/time-utils';

export class SchedulerSettingsManager {
  constructor(
    private store: SchedulerSettingsStore,
    private analytics: AnalyticsManager,
    private slackDataStore: SlackDataStore,
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
    dayOfweek: number,
    limit?: number,
    offset?: number,
  ): Promise<UserSchedulerSettings[]> {
    return this.store.fetchUsersSettingsInInterval(
      timeHour,
      dayOfweek,
      limit,
      offset,
    );
  }

  async saveDefaultUserSchedulerSettings(
    client: WebClient,
    userId: string,
    teamId: string,
    selectedChannels: string[],
  ) {
    try {
      const usersettings = new UserSchedulerSettings();
      const prevSettings = await this.fetchUserSettings(userId, teamId);

      if (prevSettings) {
        return;
      }

      const userInfo = await this.slackDataStore.getUserInfoData(
        userId,
        teamId,
        client,
      );
      if (userInfo?.tz_offset === undefined) {
        logger.error(
          `could not fetch user: ${userId} info to get timezone when saving default user settings`,
        );
        return;
      }

      usersettings.slackUser = userId;
      usersettings.slackTeam = teamId;
      usersettings.enabled = true;
      usersettings.timeHour = calculateUserDefaultHour(
        userInfo.tz_offset,
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
    } catch (e) {
      logger.error({
        msg: 'error occurred when saving default settings',
        error: e,
      });
    }
  }

  async disableSchedulerSettings(userId: string, teamId: string) {
    return this.store.disableSchedulerSettings(userId, teamId);
  }
}
