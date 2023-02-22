import { AnalyticsManager, PgInstallationStore } from '@base/gistbot-shared';
import { logger } from '@base/logger';
import { IQueueConfig } from '@base/queues';
import { BullMQUtil } from '@base/utils';
import { WebClient } from '@slack/web-api';
import { Job } from 'bullmq';
import { saveDefaultEmailDigestSettings } from '../email-for-slack/email-digest-settings/email-digest-settings-client';
import {
  GmailDigest,
  JobsTypes,
  SlackIdToMailResponse,
} from '../email-for-slack/types';
import { UserLink } from '../slack/components/user-link';
import { SlackDataStore } from '../utils/slack-data-store';
import { HomeDataStore } from './home-data-store';
import EventEmitter = require('events');
import { UPDATE_HOME_EVENT_NAME } from './types';

const QUEUE_NAME = 'emailMessageSender';
type JobData = GmailDigest | SlackIdToMailResponse;

export class EmailDigestManager extends BullMQUtil<JobData> {
  constructor(
    queueCfg: IQueueConfig,
    private installationStore: PgInstallationStore,
    private analyticsManager: AnalyticsManager,
    private slackDataStore: SlackDataStore,
    private homeDataStore: HomeDataStore,
    private eventsEmitter: EventEmitter,
  ) {
    super(QUEUE_NAME, queueCfg);
  }

  async handleMessage(job: Job<JobData>) {
    switch (job.name) {
      case JobsTypes.DIGEST:
        await this.sendDigest(job.data as GmailDigest);
        break;
      case JobsTypes.ONBOARDING:
        await this.handleOnboarding(job.data as SlackIdToMailResponse);
    }
  }

  private async sendDigest(data: GmailDigest) {
    const { slackUserId, slackTeamId, userId } = data.metedata;
    try {
      logger.debug('handleDigestUpdated');

      await this.homeDataStore.updateEmailDigest(
        { slackTeamId, slackUserId },
        data,
      );

      this.eventsEmitter.emit(UPDATE_HOME_EVENT_NAME, { ...data.metedata });

      logger.debug({
        msg: `send email digest message completed for user email: ${userId}, slackUserId: ${slackUserId}`,
      });

      this.sendDigestAnalytics(data);
    } catch (e) {
      logger.error(
        `error in sending email digest for user email: ${userId}, slackUserId: ${slackUserId}, ${e} ${e.stack}`,
      );
    }
  }

  private sendDigestAnalytics(data: GmailDigest) {
    const { slackUserId, slackTeamId, userId } = data.metedata;
    const sectionStats = data.sections
      .map((s) => ({
        name: s.title,
        count: s.messages.length,
      }))
      .reduceRight((acc, curr) => {
        acc[curr.name] = curr.count;
        return acc;
      }, {} as Record<string, number>);
    this.analyticsManager.gmailDigestSent({
      slackUserId,
      slackTeamId,
      extraParams: {
        email: userId,
        ...sectionStats,
      },
    });
  }

  private async handleOnboarding(data: SlackIdToMailResponse) {
    logger.info({
      msg: 'handleOnboarding for gmail message starting',
      job: data,
    });

    const { slackUserId, slackTeamId, email } = data;
    try {
      const installation =
        await this.installationStore.fetchInstallationByTeamId(slackTeamId);

      if (!installation.bot?.token) {
        throw new Error(`no bot token for team ${slackTeamId}`);
      }

      const client = new WebClient(installation.bot?.token);
      await saveDefaultEmailDigestSettings(
        slackUserId,
        slackTeamId,
        email,
        client,
        this.slackDataStore,
      );
      const text = `:wave: Hey ${UserLink(
        slackUserId,
      )}, you successfuly logged in to Gistbot for Gmail!`;

      await client.chat.postMessage({
        channel: slackUserId,
        text,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text,
            },
          },
        ],
      });

      await this.homeDataStore.updateGmailConnectionStatus(
        { slackUserId, slackTeamId },
        true,
      );

      this.eventsEmitter.emit(UPDATE_HOME_EVENT_NAME, { ...data });

      this.analyticsManager.gmailOnboardingFunnel({
        funnelStep: 'completed',
        slackUserId,
        slackTeamId,
        extraParams: {
          email,
        },
      });

      logger.debug({ msg: 'send onboarding for Gist for Gmail completed' });
    } catch (e) {
      logger.error(
        `error in handleOnboarding for user email: ${email}, slackUserId: ${slackUserId}, ${e}`,
      );
    }
  }
}
