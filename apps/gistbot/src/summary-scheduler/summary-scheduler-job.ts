import {
  SubscriptionManager,
  SubscriptionTier,
} from '@base/customer-identifier';
import { AnalyticsManager, PgInstallationStore } from '@base/gistbot-shared';
import { logger } from '@base/logger';
import { IReporter } from '@base/metrics';
import { WebClient } from '@slack/web-api';
import * as cron from 'node-cron';
import { FeatureLimits } from '../feature-rate-limiter/limits';
import { OnboardingManager } from '../onboarding/manager';
import { ScheduledMultiChannelSummary } from '../slack/components/scheduled-multi-channel-summary';
import { ScheduledMessageSender } from '../slack/scheduled-messages/manager';
import {
  MultiChannelSummarizer,
  OutputError,
} from '../summaries/channel/multi-channel-summarizer';
import { generateIDAsync } from '../utils/id-generator.util';
import { delay } from '../utils/retry';
import { SchedulerSettingsManager } from './scheduler-manager';
import { RedisSchedulerSettingsLock } from './scheduler-settings-lock';
import {
  JOB_MINUTES_INTERVAL,
  LIMIT,
  TIME_MINUTES_TO_LOCK,
  UserSchedulerSettings,
} from './types';

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
    private onboardingManager: OnboardingManager,
    private metricsReporter: IReporter,
  ) {
    this.metricsReporter.registerCounter(
      'slack_digest_schedule_run_count',
      'A counter for the number of times a slack digest schedule run',
      ['slack_team', 'is_sent_to_user'],
    );
  }
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

      const currentDay = new Date().getDay();

      const usersSettings =
        await this.schedulerMgr.fetchUsersSettingsInInterval(
          timeToFetchSettings,
          currentDay,
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
      await delay(1000 * 60);
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

      logger.debug(
        `starting scheduled job for user ${userSettings.slackUser} in team ${userSettings.slackTeam}`,
      );
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
      // all public channels or private channels in which the user is a member
      let limitedChannelSummries = await this.getUserAccessibleChannels(
        userSettings.channels,
        client,
        userSettings.slackUser,
      );

      if (!limitedChannelSummries) {
        const errMsg = `There are no valid channels to be summarized for the user ${userSettings.slackUser}`;
        logger.error(errMsg);
        throw new Error(errMsg);
      }

      let nonIncludingChannels: string[] = [];
      let featureLimit: number | 'infinite' = 0;
      let tier = SubscriptionTier.FREE;
      const scheduledSummariesFreeTierLimit = FeatureLimits.SCHEDULED_SUMMARIES
        .FREE as number;
      if (limitedChannelSummries.length > scheduledSummariesFreeTierLimit) {
        tier = await this.subscriptionManager.userTier(
          userSettings.slackTeam,
          userSettings.slackUser,
        );

        featureLimit = FeatureLimits.SCHEDULED_SUMMARIES[tier];
        if (featureLimit !== 'infinite') {
          limitedChannelSummries = limitedChannelSummries.slice(
            0,
            featureLimit,
          );
          nonIncludingChannels = limitedChannelSummries
            .slice(featureLimit)
            .map((c) => c.channelId);
        }
      }

      const { summaryMetrics, timeToSchedule, isSentToUser } =
        await this.sendScheduledSummaries(
          client,
          sessionId,
          userSettings,
          tier,
          limitedChannelSummries,
          nonIncludingChannels,
          Number(featureLimit),
          botId,
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
        channelIds: limitedChannelSummries.map((c) => c.channelId),
        scheduledTime: timeToSchedule?.toString(),
        isSentToUser,
        extraParams: {
          gist_session: sessionId,
          number_of_summarized_channels: limitedChannelSummries.length,
          number_of_successful_summaries: summaryMetrics.successful,
          number_of_moderated_summaries: summaryMetrics.moderated,
          number_of_too_small_summaries: summaryMetrics.channel_too_small,
          number_of_insuficent_messages: summaryMetrics.no_msg_error,
          number_of_error_summaries: summaryMetrics.general_error,
        },
      });

      this.metricsReporter.incrementCounter(
        'slack_digest_schedule_run_count',
        1,
        {
          slack_team: userSettings.slackTeam,
          is_sent_to_user: isSentToUser ? 'true' : 'false',
        },
      );

      await this.schedulerMgr.updateUserTimeZone(
        userSettings,
        new WebClient(token),
      );

      await this.onboardingManager.completeOnboarding(
        userSettings.slackTeam,
        userSettings.slackUser,
      );
    } catch (e) {
      this.metricsReporter.error(
        'schedule slack digest run error',
        'handle-slack-digest-schedule',
        userSettings.slackTeam,
      );

      logger.error(
        `error in scheduler summaries for user ${userSettings.slackUser} in team ${userSettings.slackTeam}, error: ${e}`,
      );
    }
  }

  private async getUserAccessibleChannels(
    channels: { channelId: string; channelName: string }[],
    client: WebClient,
    user_id: string,
  ) {
    const maxUsersAvailable = 1000;

    const userAccessibleChannelsPromises = channels.map(async (channel) => {
      try {
        const channelInfo = await client.conversations.info({
          channel: channel.channelId,
        });
        if (!channelInfo.channel?.is_private) {
          return channel;
        }
        const channelMembers = await client.conversations.members({
          channel: channel.channelId,
          limit: maxUsersAvailable,
        });
        const hasMoreMembersThanLimit =
          channelMembers.response_metadata?.next_cursor;
        if (
          channelMembers?.members?.includes(user_id) ||
          hasMoreMembersThanLimit
        ) {
          return channel;
        }
        logger.warn(
          `User ${user_id} doesn't have access to channel ${channel.channelName} `,
        );
      } catch (error) {
        logger.error(
          `Error while getting user:${user_id} info from slack, error : ${error} `,
        );
      }
    });

    const userAccessibleChannels = await Promise.all(
      userAccessibleChannelsPromises,
    );
    return userAccessibleChannels.filter((result) => result !== undefined) as {
      channelId: string;
      channelName: string;
    }[];
  }

  private async sendScheduledSummaries(
    client: WebClient,
    sessionId: string,
    userSettings: UserSchedulerSettings,
    tier: string,
    channelsToSummarize: { channelId: string; channelName: string }[],
    nonIncludingChannels: string[],
    featureLimit: number,
    botId?: string,
  ): Promise<{
    summaryMetrics: Record<OutputError | 'successful', number>;
    isSentToUser: boolean;
    timeToSchedule?: Date;
  }> {
    const summaries = await this.multiChannelSummarizer.summarize(
      'subscription',
      botId || '',
      userSettings.slackTeam,
      userSettings.slackUser,
      {
        type: 'multi_channel',
        channels: channelsToSummarize.map(({ channelId, channelName }) => {
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

    const summaryMetrics: Record<OutputError | 'successful', number> = {
      moderated: 0,
      channel_too_small: 0,
      general_error: 0,
      successful: 0,
      no_msg_error: 0,
    };
    summaries.summaries.forEach((summary) => {
      if (summary.error) {
        summaryMetrics[summary.error]++;
        return;
      }
      summaryMetrics.successful++;
    });

    if (summaryMetrics.successful === 0) {
      logger.debug(
        `errors in all summaraies for user ${userSettings.slackUser}, skip sending scheduled diget`,
      );
      return { summaryMetrics, isSentToUser: false };
    }

    const summariesFormatted =
      this.multiChannelSummarizer.getMultiChannelSummaryFormatted(summaries);

    const timeToSchedule = new Date();
    timeToSchedule.setUTCHours(userSettings.timeHour, 0, 0);

    // post scheduled message to slack
    await this.scheduledMessageSender.sendScheduledMessage(
      'scheduled_multi_channel_summary',
      {
        channel: userSettings.slackUser,
        text: `Your summaries for ${channelsToSummarize.length} channels`,
        blocks: ScheduledMultiChannelSummary(
          summariesFormatted,
          featureLimit,
          tier,
          nonIncludingChannels,
          sessionId,
          userSettings.selectedHour,
          userSettings.slackUser,
        ),
        unfurl_links: false,
        unfurl_media: false,
      },
      userSettings.slackUser,
      userSettings.slackTeam,
      timeToSchedule,
    );

    logger.debug(
      `${summaries.summaries.length} will scheduled to be sent at ${timeToSchedule} for user ${userSettings.slackUser} from team ${userSettings.slackTeam}`,
    );
    return {
      summaryMetrics,
      isSentToUser: true,
      timeToSchedule,
    };
  }
}
