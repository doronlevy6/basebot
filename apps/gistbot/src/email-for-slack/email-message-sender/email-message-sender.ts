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
import { MessageResponseJob } from '../types';

const QUEUE_NAME = 'emailMessageSender';

export class EmailMessageSender {
  private queueCfg: IQueueConfig;
  private messageSenderWorker: Worker<MessageResponseJob>;
  private messageSenderQueue: QueueWrapper<MessageResponseJob>;

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

    this.messageSenderWorker = createQueueWorker<MessageResponseJob>(
      QUEUE_NAME,
      this.queueCfg,
      async (job) => {
        await this.sendMessage(job);
      },
    );

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

  private async sendMessage(job: Job<MessageResponseJob>) {
    logger.debug({ msg: 'send scheduled message starting', job: job.data });

    const { slackUserId, slackTeamId } = job.data.metedata;

    const installation = await this.installationStore.fetchInstallationByTeamId(
      slackTeamId,
    );

    if (!installation.bot?.token) {
      throw new Error(`no bot token for team ${slackTeamId}`);
    }

    const textBlocks = job.data.data.flatMap((data) => {
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

    logger.debug({ msg: 'send email message completed', job: job.data });
  }
}
