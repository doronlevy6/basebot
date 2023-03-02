import { AnalyticsManager, PgInstallationStore } from '@base/gistbot-shared';
import { logger } from '@base/logger';
import { IQueueConfig } from '@base/queues';
import { BullMQUtil } from '@base/utils';
import { WebClient } from '@slack/web-api';
import { Job } from 'bullmq';
import { saveDefaultEmailDigestSettings } from '../email-for-slack/email-digest-settings/email-digest-settings-client';
import {
  GmailDigest,
  GmailDigestSection,
  JobsTypes,
  SlackIdToMailResponse,
} from '../email-for-slack/types';
import { SlackDataStore } from '../utils/slack-data-store';
import { HomeDataStore } from './home-data-store';
import {
  ON_MESSAGE_CLEARED_EVENT_NAME,
  OnMessageClearedEvent,
  UPDATE_EMAIL_REFRESH_METADATA_EVENT_NAME,
  UPDATE_HOME_EVENT_NAME,
  UPDATE_HOME_USER_REFRESH,
  UpdateEmailRefreshMetadataEvent,
} from './types';
import { sendRefreshRequestToMailbot } from '../email-for-slack/action-handlers/refresh-gmail';
import EventEmitter = require('events');

const QUEUE_NAME = 'emailMessageSender';
type JobData = GmailDigest | SlackIdToMailResponse;
const HOME_REFRESH_THRESHOLD_MINUTES = 15;

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
    this.eventsEmitter.on(ON_MESSAGE_CLEARED_EVENT_NAME, (data) => {
      this.onMessageClearedNotification(data).catch(logger.error);
    });

    this.eventsEmitter.on(UPDATE_EMAIL_REFRESH_METADATA_EVENT_NAME, (data) => {
      this.updateEmailRefreshMetadata(data).catch(logger.error);
    });

    this.eventsEmitter.on(UPDATE_HOME_USER_REFRESH, (data) => {
      this.updateHomeUserRefresh(data).catch(logger.error);
    });
  }

  async handleMessage(job: Job<JobData>) {
    switch (job.name) {
      case JobsTypes.DIGEST:
        await this.sendDigest(job.data as GmailDigest);
        break;
      case JobsTypes.ONBOARDING:
        await this.handleOnboarding(job.data as SlackIdToMailResponse);
        break;
      case JobsTypes.REFRESH_UPDATE:
        await this.updateEmailRefreshMetadata(
          job.data as UpdateEmailRefreshMetadataEvent,
        );
        break;
      default:
        logger.warn(`unknown job type: ${job.name}`);
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

      await this.homeDataStore.updateGmailConnectionStatus(
        { slackUserId, slackTeamId },
        new Date(),
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

  private async onMessageClearedNotification({
    id,
    slackUserId,
    slackTeamId,
  }: OnMessageClearedEvent) {
    try {
      const data = await this.homeDataStore.fetch({
        slackUserId,
        slackTeamId,
      });

      logger.info(`will clear email for ${slackUserId} in ${slackTeamId}...`);

      const digest = data?.gmailDigest?.digest;
      if (!digest) {
        logger.warn(
          `no gmail digest was found for ${slackUserId} in ${slackTeamId}...`,
        );
        return;
      }

      logger.debug(
        `will update gmail digest for ${slackUserId} in ${slackTeamId}...`,
      );

      const { digest: updatedDigest, foundMatch } = this.filteredDigest(
        digest,
        id,
      );

      if (!foundMatch) {
        logger.warn(
          `no match was found for ${id} ${slackUserId} in ${slackTeamId}...`,
        );
        return;
      }

      await this.homeDataStore.updateEmailDigest(
        { slackTeamId, slackUserId },
        updatedDigest,
      );

      logger.debug(
        `gmail digest was updated for ${slackUserId} in ${slackTeamId}...`,
      );

      this.eventsEmitter.emit(UPDATE_HOME_EVENT_NAME, {
        slackUserId,
        slackTeamId,
      });
    } catch (e) {
      logger.error(`error clearing message: ${e}`);
    }
  }

  private filteredDigest(digest: GmailDigest, id: string) {
    const { sections } = digest;
    let foundMatch = false;
    const newSections: GmailDigestSection[] = [];
    for (const section of sections) {
      if (section.id === id) {
        foundMatch = true;
        logger.debug(`filteredDigest detection matched section for ${id}`);
        continue;
      }

      const newMessages = section.messages.filter((m) => {
        if (m.id === id) {
          foundMatch = true;
          logger.debug(`filteredDigest detection matched message for ${id}`);
          return false;
        }
        return true;
      });

      if (newMessages.length === 0) {
        logger.debug(`filteredDigest detection matched section for ${id}`);
        continue;
      }

      newSections.push({
        ...section,
        messages: newMessages,
      });
    }

    return { foundMatch, digest: { ...digest, sections: newSections } };
  }

  private async updateEmailRefreshMetadata({
    metadata,
    slackUserId,
    slackTeamId,
  }: UpdateEmailRefreshMetadataEvent) {
    try {
      logger.debug(
        `Will refresh metadata for ${slackUserId} in ${slackTeamId}. ${JSON.stringify(
          metadata,
        )}`,
      );

      await this.homeDataStore.updateEmailRefreshMetadata(
        { slackTeamId, slackUserId },
        metadata,
      );

      logger.debug(
        `Update refresh metadata for ${slackUserId} in ${slackTeamId}. ${JSON.stringify(
          metadata,
        )}`,
      );

      this.eventsEmitter.emit(UPDATE_HOME_EVENT_NAME, {
        slackUserId,
        slackTeamId,
      });
    } catch (e) {
      logger.error(`error updating refresh metadata message: ${e}`);
    }
  }

  private async updateHomeUserRefresh({
    metadata,
    slackUserId,
    slackTeamId,
    email,
  }: UpdateEmailRefreshMetadataEvent) {
    try {
      logger.debug(
        `Will refresh metadata for ${slackUserId} in ${slackTeamId}. ${JSON.stringify(
          metadata,
        )}`,
      );
      const state = await this.homeDataStore.fetch({
        slackUserId,
        slackTeamId,
      });
      const refreshTriggered = this.refreshStateIfNeeded(
        slackTeamId,
        slackUserId,
        state?.gmailDigest?.lastUpdated,
      );
      if (!refreshTriggered) {
        return;
      }

      await this.updateEmailRefreshMetadata({
        slackTeamId,
        slackUserId,
        email,
        metadata: {
          refreshing: true,
        },
      });
    } catch (e) {
      logger.error(`error updating refresh metadata message: ${e}`);
    }
  }

  private refreshStateIfNeeded = (
    slackTeamId: string,
    slackUserId: string,
    lastUpdated?: number,
  ): boolean => {
    if (lastUpdated) {
      const lastUpdatedWithBuffer =
        lastUpdated + HOME_REFRESH_THRESHOLD_MINUTES * 1000 * 60;

      const passedThreshold = lastUpdatedWithBuffer < new Date().getTime();

      if (passedThreshold) {
        logger.info(
          `passed threshold of ${HOME_REFRESH_THRESHOLD_MINUTES} minutes, refreshing now`,
        );
        sendRefreshRequestToMailbot(
          slackUserId,
          slackTeamId,
          this.eventsEmitter,
        ).catch((err) => logger.error(`error refreshing mails: ${err}`));
        return true;
      }
      logger.info(
        `did not passed threshold of ${HOME_REFRESH_THRESHOLD_MINUTES} minutes, skipping`,
      );
    }
    return false;
  };
}
