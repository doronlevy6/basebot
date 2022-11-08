import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import * as cron from 'node-cron';
import { AnalyticsManager } from '../analytics/manager';
import { PgInstallationStore } from '../installations/installationStore';
import { MultiChannelSummarizer } from '../summaries/channel/multi-channel-summarizer';
import { RedisSchedulerSettingsLock } from './scheduler-settings-lock';
import { SchedulerSettingsStore } from './scheduler-store';
import {
  JOB_MINUTES_INTERVAL,
  LIMIT,
  TIME_MINUTES_TO_LOCK,
  UserSchedulerSettings,
} from './types';

export class SummarySchedulerJob {
  constructor(
    private schedulerStore: SchedulerSettingsStore,
    private schedulerLock: RedisSchedulerSettingsLock,
    private multiChannelSummarizer: MultiChannelSummarizer,
    private installationStore: PgInstallationStore,
    private analyticsManager: AnalyticsManager,
  ) {}

  start() {
    cron.schedule(`0 */${JOB_MINUTES_INTERVAL} * * * *`, async () => {
      await this.handleScheduler();
    });
  }

  async handleScheduler() {
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // set interval for next hour, to be able to process summaries ahead of time.
      const timeToFetchSettings = new Date().getUTCHours() + 1;
      const usersSettings =
        await this.schedulerStore.fetchUsersSettingsInInterval(
          timeToFetchSettings,
          LIMIT,
          offset,
        );
      if (!usersSettings || usersSettings.length === 0) {
        logger.debug(
          `no users settings were fetched in time interval in offset ${offset}`,
        );
        break;
      }

      logger.debug(
        `found ${usersSettings.length} users settings in time interval`,
      );
      offset += LIMIT;
      const usersScheduledNotifications: Promise<void>[] = [];
      for (const userSett of usersSettings) {
        usersScheduledNotifications.push(
          this.handleUserScheduledNotification(userSett),
        );
      }
      // execute all promises - resolved and rejected, that one rejected promise won't effect to send summaries to other users
      Promise.allSettled(usersScheduledNotifications);
    }
  }

  private async handleUserScheduledNotification(
    userSettings: UserSchedulerSettings,
  ) {
    try {
      // short lock for current time interval
      const acquired = await this.schedulerLock.lock(
        userSettings.slackTeam,
        userSettings.slackUser,
        JOB_MINUTES_INTERVAL + 1,
      );
      if (!acquired) {
        logger.debug(
          `could not aquire lock for scheduler notification job, already acquired`,
        );
        return;
      }

      const installation =
        await this.installationStore.fetchInstallationByTeamId(
          userSettings.slackTeam,
        );
      const token = installation?.bot?.token;
      const botId = installation?.bot?.id;
      if (!token) {
        const errMsg = `no token was found for team ${userSettings.slackTeam} when trying to send scheduled summary`;
        logger.error(errMsg);
        throw new Error(errMsg);
      }

      const client = new WebClient(token);
      const summaries = await this.multiChannelSummarizer.summarize(
        'subscription',
        botId || '',
        userSettings.slackTeam,
        userSettings.slackUser,
        {
          type: 'multi_channel',
          channels: userSettings.channels.map(({ channelId, channelName }) => {
            return {
              channelId: channelId,
              channelName: channelName as string,
            };
          }),
        },
        client,
        1,
      );

      logger.debug(
        `found ${summaries.summaries.length} channels summaries for user ${userSettings.slackUser} from team ${userSettings.slackTeam}`,
      );

      // TODO handle if needed
      if (summaries.error) {
        logger.debug(
          `errors from multi channel summarizer:  ${summaries.error}`,
        );
      }

      const timeToSchedule = new Date();
      timeToSchedule.setHours(userSettings.timeHour, 0, 0);

      // post scheduled message to slack
      await client.chat.scheduleMessage({
        channel: userSettings.slackUser,
        text: JSON.stringify(summaries),
        post_at: (timeToSchedule.getTime() / 1000).toFixed(0),
      });

      logger.debug(
        `${summaries.summaries.length} will scheduled to be sent at ${timeToSchedule} for user ${userSettings.slackUser} from team ${userSettings.slackTeam}`,
      );

      // externd the lock for long time - that won't be processed in next intervals
      await this.schedulerLock.extend(
        userSettings.slackTeam,
        userSettings.slackUser,
        TIME_MINUTES_TO_LOCK,
      );

      this.analyticsManager.scheduledMultichannelSummaryFunnel({
        slackUserId: userSettings.slackUser,
        slackTeamId: userSettings.slackTeam,
        channedIds: userSettings.channels.map((c) => c.channelId),
        scheduledTime: timeToSchedule.toString(),
      });
    } catch (e) {
      logger.error(
        `error in scheduler summaries for user ${userSettings.slackUser} in team ${userSettings.slackTeam}, error: ${e}`,
      );
    }
  }
}
