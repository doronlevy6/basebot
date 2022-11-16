import { SubscriptionManager } from '@base/customer-identifier';
import { logger } from '@base/logger';
import { generateIDAsync } from '../utils/id-generator.util';
import { WebClient } from '@slack/web-api';
import * as cron from 'node-cron';
import { AnalyticsManager } from '../analytics/manager';
import { FeatureLimits } from '../feature-rate-limiter/limits';
import { PgInstallationStore } from '../installations/installationStore';
import { ScheduledMultiChannelSummary } from '../slack/components/scheduled-multi-channel-summary';
import { MultiChannelSummarizer } from '../summaries/channel/multi-channel-summarizer';
import { SchedulerSettingsManager } from './scheduler-manager';
import { RedisSchedulerSettingsLock } from './scheduler-settings-lock';
import {
  JOB_MINUTES_INTERVAL,
  LIMIT,
  TIME_MINUTES_TO_LOCK,
  UserSchedulerSettings,
} from './types';
import { ScheduledMessageSender } from '../slack/scheduled-messages/manager';

export class SummarySchedulerJob {
  private readonly tempWeekDays = '0,1,2,3,4,5';
  constructor(
    private schedulerMgr: SchedulerSettingsManager,
    private schedulerLock: RedisSchedulerSettingsLock,
    private multiChannelSummarizer: MultiChannelSummarizer,
    private installationStore: PgInstallationStore,
    private analyticsManager: AnalyticsManager,
    private subscriptionManager: SubscriptionManager,
    private scheduledMessageSender: ScheduledMessageSender,
  ) {}

  start() {
    cron.schedule(
      `0 */${JOB_MINUTES_INTERVAL} * * * ${this.tempWeekDays}`,
      // Internally the cron should handle promises, this is an incorrect signature.
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async () => {
        await this.handleScheduler();
      },
    );
  }

  async handleScheduler() {
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // set interval for next hour, to be able to process summaries ahead of time.
      const timeToFetchSettings = new Date().getUTCHours() + 1;
      const usersSettings =
        await this.schedulerMgr.fetchUsersSettingsInInterval(
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
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
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

      const sessionId = await generateIDAsync();

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

      let limitedChannelSummries = userSettings.channels;
      let nonIncludingChannels: string[] = [];
      let featureLimit: number | 'infinite' = 0;
      if (
        userSettings.channels.length > FeatureLimits.SCHEDULED_SUMMARIES.FREE
      ) {
        const tier = await this.subscriptionManager.userTier(
          userSettings.slackTeam,
          userSettings.slackUser,
        );

        featureLimit = FeatureLimits.SCHEDULED_SUMMARIES[tier];
        if (featureLimit !== 'infinite') {
          limitedChannelSummries = userSettings.channels.slice(0, featureLimit);
          nonIncludingChannels = userSettings.channels
            .slice(featureLimit)
            .map((c) => c.channelId);
        }
      }

      const summaries = await this.multiChannelSummarizer.summarize(
        'subscription',
        botId || '',
        userSettings.slackTeam,
        userSettings.slackUser,
        {
          type: 'multi_channel',
          channels: limitedChannelSummries.map(({ channelId, channelName }) => {
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
        `found ${summaries?.summaries?.length} channels summaries for user ${userSettings.slackUser} from team ${userSettings.slackTeam}`,
      );

      const summariesFormatted =
        await this.multiChannelSummarizer.getMultiChannelSummaryFormatted(
          summaries,
          client,
        );

      const timeToSchedule = new Date();
      timeToSchedule.setUTCHours(userSettings.timeHour, 0, 0);

      // post scheduled message to slack
      await this.scheduledMessageSender.sendScheduledMessage(
        {
          channel: userSettings.slackUser,
          text: `Your summaries for ${limitedChannelSummries.length} channels`,
          blocks: ScheduledMultiChannelSummary(
            summariesFormatted,
            Number(featureLimit),
            nonIncludingChannels,
            sessionId,
            userSettings.selectedHour,
          ),
          unfurl_links: false,
          unfurl_media: false,
        },
        userSettings.slackTeam,
        timeToSchedule,
      );

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
        extraParams: {
          gist_session: sessionId,
        },
      });
    } catch (e) {
      logger.error(
        `error in scheduler summaries for user ${userSettings.slackUser} in team ${userSettings.slackTeam}, error: ${e}`,
      );
    }
  }
}
