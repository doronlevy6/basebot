import { logger } from '@base/logger';
import { Job, Worker } from 'bullmq';
import {
  createQueue,
  createQueueWorker,
  IQueueConfig,
  QueueWrapper,
} from '@base/queues';
import { WebClient } from '@slack/web-api';
import { AnalyticsManager, PgInstallationStore } from '@base/gistbot-shared';
import { JobsTypes, MessageResponse, SlackIdToMailResponse } from '../types';
import { UserLink } from '../../slack/components/user-link';

const QUEUE_NAME = 'emailMessageSender';

export class EmailMessageSender {
  private queueCfg: IQueueConfig;
  private messageSenderWorker: Worker<MessageResponse | SlackIdToMailResponse>;
  private messageSenderQueue: QueueWrapper<
    MessageResponse | SlackIdToMailResponse
  >;

  constructor(
    queueCfg: IQueueConfig,
    private installationStore: PgInstallationStore,
    private analyticsManager: AnalyticsManager,
  ) {
    this.queueCfg = queueCfg;
  }

  async isReady(): Promise<boolean> {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    this.messageSenderQueue = createQueue(QUEUE_NAME, this.queueCfg);

    this.messageSenderWorker = createQueueWorker<
      MessageResponse | SlackIdToMailResponse
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
    await this.messageSenderQueue.scheduler.close();
    await this.messageSenderWorker.close();
  }

  private async handleMessage(
    job: Job<MessageResponse | SlackIdToMailResponse>,
  ) {
    switch (job.name) {
      case JobsTypes.DIGEST:
        await this.sendDigest(job.data as MessageResponse);
        break;
      case JobsTypes.ONBOARDING:
        await this.sendOnboarding(job.data as SlackIdToMailResponse);
    }
  }

  private async sendDigest(data: MessageResponse) {
    logger.debug({ msg: 'send scheduled message starting', job: data });

    const { slackUserId, slackTeamId } = data.metedata;
    const installation = await this.installationStore.fetchInstallationByTeamId(
      slackTeamId,
    );

    if (!installation.bot?.token) {
      throw new Error(`no bot token for team ${slackTeamId}`);
    }

    const textBlocks = data.data.flatMap((data) => {
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: data.snippet,
          },
        },
        {
          type: 'divider',
        },
      ];
    });
    const client = new WebClient(installation.bot?.token);
    await client.chat.postMessage({
      channel: slackUserId,
      text: 'all emails',
      //TODO remove slice, and send different messages
      blocks: textBlocks.slice(0, 20),
    });

    logger.debug({ msg: 'send email message completed' });
  }

  private async sendOnboarding(data: SlackIdToMailResponse) {
    logger.debug({
      msg: 'sendOnboarding for gmail message starting',
      job: data,
    });

    const { slackUserId, slackTeamId } = data;
    const installation = await this.installationStore.fetchInstallationByTeamId(
      slackTeamId,
    );

    if (!installation.bot?.token) {
      throw new Error(`no bot token for team ${slackTeamId}`);
    }

    const client = new WebClient(installation.bot?.token);
    await client.chat.postMessage({
      channel: slackUserId,
      text: `:wave: Hey ${UserLink(
        slackUserId,
      )}, you successfuly logged in to Gistbot for Gmail!`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:wave: Hey ${UserLink(
              slackUserId,
            )}, you successfuly logged in to Gistbot for Gmail!`,
          },
        },
      ],
    });

    logger.debug({ msg: 'send onboarding for Gist for Gmail completed' });
  }
}
