import { logger } from '@base/logger';
import { Job, Worker } from 'bullmq';
import {
  createQueue,
  createQueueWorker,
  IQueueConfig,
  QueueWrapper,
} from '@base/queues';
import { ChatPostMessageArguments, WebClient } from '@slack/web-api';
import { AnalyticsManager, PgInstallationStore } from '@base/gistbot-shared';

const QUEUE_NAME = 'sendScheduledMessage';

interface ScheduledMessageJob {
  messageType: string;
  teamId: string;
  slackUserId: string;
  args: ChatPostMessageArguments;
}

export class ScheduledMessageSender {
  private queueCfg: IQueueConfig;
  private messageSenderWorker: Worker<ScheduledMessageJob>;
  private messageSenderQueue: QueueWrapper<ScheduledMessageJob>;

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

    this.messageSenderWorker = createQueueWorker<ScheduledMessageJob>(
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

  async sendScheduledMessage(
    messageType: string,
    args: ChatPostMessageArguments,
    userId: string,
    teamId: string,
    post_at: Date,
  ) {
    logger.debug({
      msg: 'adding send scheduled message job',
      args: args,
      teamId: teamId,
      post_at: post_at,
    });

    const now = new Date();
    const delay = +post_at - +now;

    await this.messageSenderQueue.queue.add(
      QUEUE_NAME,
      {
        messageType: messageType,
        slackUserId: userId,
        args: args,
        teamId: teamId,
      },
      {
        delay: delay,
      },
    );

    logger.debug({
      msg: 'adding send scheduled message job',
      args: args,
      teamId: teamId,
      post_at: post_at,
      calculatedDelay: delay,
    });
  }

  private async sendMessage(job: Job<ScheduledMessageJob>) {
    logger.debug({ msg: 'send scheduled message starting', job: job.data });

    const { messageType, slackUserId, args, teamId } = job.data;

    const installation = await this.installationStore.fetchInstallationByTeamId(
      teamId,
    );

    if (!installation.bot?.token) {
      throw new Error(`no bot token for team ${teamId}`);
    }

    const client = new WebClient(installation.bot?.token);
    await client.chat.postMessage(args);
    logger.debug({ msg: 'send scheduled message completed', job: job.data });

    this.analyticsManager.messageSentToUserDM({
      type: messageType,
      slackTeamId: teamId,
      slackUserId: slackUserId,
    });
  }
}
