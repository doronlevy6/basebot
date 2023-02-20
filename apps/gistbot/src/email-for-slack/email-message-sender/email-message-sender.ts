import { AnalyticsManager, PgInstallationStore } from '@base/gistbot-shared';
import { logger } from '@base/logger';
import {
  createQueue,
  createQueueWorker,
  IQueueConfig,
  QueueWrapper,
} from '@base/queues';
import { WebClient } from '@slack/web-api';
import { Job, Worker } from 'bullmq';
import { UserLink } from '../../slack/components/user-link';
import { SlackDataStore } from '../../utils/slack-data-store';
import { createEmailDigestBlocks } from '../components/email-digest-blocks';
import { saveDefaultEmailDigestSettings } from '../email-digest-settings/email-digest-settings-client';
import { GmailDigest, JobsTypes, SlackIdToMailResponse } from '../types';
import { EmailHomeView } from '../views/email-home-view';

const QUEUE_NAME = 'emailMessageSender';

export class EmailMessageSender {
  private queueCfg: IQueueConfig;
  private messageSenderWorker: Worker<GmailDigest | SlackIdToMailResponse>;
  private messageSenderQueue: QueueWrapper<GmailDigest | SlackIdToMailResponse>;

  constructor(
    queueCfg: IQueueConfig,
    private installationStore: PgInstallationStore,
    private analyticsManager: AnalyticsManager,
    private slackDataStore: SlackDataStore,
  ) {
    this.queueCfg = queueCfg;
  }

  async isReady(): Promise<boolean> {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    this.messageSenderQueue = createQueue(QUEUE_NAME, this.queueCfg);

    this.messageSenderWorker = createQueueWorker<
      GmailDigest | SlackIdToMailResponse
    >(QUEUE_NAME, this.queueCfg, async (job) => {
      await this.handleMessage(job);
    });

    for (let i = 0; i < 10; i++) {
      try {
        await (await this.messageSenderWorker.client).ping();
        await this.messageSenderQueue.queue.getWorkers();
        return true;
      } catch (error) {
        logger.error(`error pinging the queues: ${error}`);
      }
      await delay(1000 * i); // Wait for (number of seconds * loop number) so that we try a few times before giving up
    }

    return false;
  }

  async close() {
    await this.messageSenderQueue.queue.close();
    await this.messageSenderWorker.close();
  }

  private async handleMessage(job: Job<GmailDigest | SlackIdToMailResponse>) {
    switch (job.name) {
      case JobsTypes.DIGEST:
        await this.sendDigest(job.data as GmailDigest);
        ``;
        break;
      case JobsTypes.ONBOARDING:
        await this.handleOnboarding(job.data as SlackIdToMailResponse);
    }
  }

  private async sendDigest(data: GmailDigest) {
    logger.debug({ msg: 'send scheduled message starting', job: data });
    const { slackUserId, slackTeamId, userId } = data.metedata;
    try {
      const installation =
        await this.installationStore.fetchInstallationByTeamId(slackTeamId);

      if (!installation.bot?.token) {
        throw new Error(`no bot token for team ${slackTeamId}`);
      }

      const client = new WebClient(installation.bot?.token);
      const textBlocks = createEmailDigestBlocks(data.sections);
      await client.views.publish({
        user_id: slackUserId,
        view: EmailHomeView(textBlocks, {
          teamId: slackTeamId,
          userId: slackUserId,
          updatedAt: Date.now(),
        }),
      });

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
    logger.debug({
      msg: 'sendOnboarding for gmail message starting',
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
      )}, you successfuly logged in to Gistbot for Gmail!\nType \`/gist get mails\` to get your first digest.`;
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
