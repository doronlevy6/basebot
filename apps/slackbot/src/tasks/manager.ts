import { logger } from '@base/logger';
import { Task, User } from '@base/oapigen';
import {
  createQueue,
  createQueueWorker,
  IQueueConfig,
  QueueWrapper,
} from '@base/queues';
import {
  ActionsBlock,
  ContextBlock,
  HeaderBlock,
  InputBlock,
  SectionBlock,
  WebClient,
} from '@slack/web-api';
import { Job, Worker } from 'bullmq';
import { AnalyticsManager } from '../analytics/analytics-manager';
import { PgInstallationStore } from '../installations/installationStore';
import { SlackMessageSenderMetadata } from './types';
import { TaskView } from './view';

export type MessageBlocks =
  | SectionBlock
  | HeaderBlock
  | ActionsBlock
  | InputBlock
  | ContextBlock;

interface TaskJobData {
  user: User;
  task: Task;
}

export class TasksManager {
  private queueCfg: IQueueConfig;
  private taskStatusWorker: Worker;
  private messageSenderWorker: Worker;
  private messageSenderQueue: QueueWrapper;
  private installationStore: PgInstallationStore;

  constructor(queueCfg: IQueueConfig, installationStore: PgInstallationStore) {
    this.queueCfg = queueCfg;
    this.installationStore = installationStore;
  }

  async isReady(): Promise<boolean> {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    this.taskStatusWorker = createQueueWorker(
      'taskStatus',
      this.queueCfg,
      async (job) => {
        await this.requestTaskStatus(job);
      },
    );

    this.messageSenderQueue = createQueue(
      'sendTaskUpdateMessage',
      this.queueCfg,
    );

    this.messageSenderWorker = createQueueWorker(
      'sendTaskUpdateMessage',
      this.queueCfg,
      async (job) => {
        await this.sendMessage(job);
      },
    );

    for (let i = 0; i < 10; i++) {
      try {
        await this.messageSenderQueue.queue.getWorkers();
        await (await this.taskStatusWorker.client).ping();
        await (await this.messageSenderWorker.client).ping();
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
    await this.taskStatusWorker.close();
    await this.messageSenderWorker.close();
  }

  private async sendMessage(job: Job<SlackMessageSenderMetadata>) {
    try {
      logger.debug({ msg: 'Sending slack msg', c: job.data.channelId, job });

      const installation =
        await this.installationStore.fetchInstallationByBaseId(
          job.data.organizationId,
        );
      const client = new WebClient(installation.bot?.token);

      await client.chat.postMessage({
        channel: job.data.channelId,
        text: job.data.text,
        blocks: job.data.blocks,
      });

      this.sendAnalyticsEvent(job.data);
      logger.info({ msg: 'send task status request', job: job.data });
    } catch (e) {
      logger.error({ msg: 'error sending message', data: job.data, error: e });
      logger.error(job.data.blocks);
    }
  }

  private sendAnalyticsEvent(data: SlackMessageSenderMetadata) {
    if (data.userEmail) {
      AnalyticsManager.getInstance().messageSentToUser(data.userEmail);
    } else {
      logger.warn({ msg: 'No user email found for message analytics' });
    }
  }

  private async requestTaskStatus(job: Job<TaskJobData>) {
    logger.debug({ msg: 'requesting task status', data: job.data });

    const installation = await this.installationStore.fetchInstallationByBaseId(
      job.data.user.organizationId,
    );
    const client = new WebClient(installation.bot?.token);

    const [assigneeRes, creatorRes] = await Promise.all([
      client.users.lookupByEmail({
        email: job.data.user.email,
      }),
      client.users.lookupByEmail({
        email: job.data.task.creator.email,
      }),
    ]);

    if (assigneeRes.error || !assigneeRes.user?.id || !assigneeRes.ok) {
      throw new Error(
        `Error getting assigned user by email in slack: ${assigneeRes.error}`,
      );
    }

    if (creatorRes.error || !creatorRes.user?.id || !creatorRes.ok) {
      throw new Error(
        `Error getting task creator user by email in slack: ${creatorRes.error}`,
      );
    }
    const message = TaskView({
      assignee: { id: assigneeRes.user.id },
      creator: { id: creatorRes.user.id },
      baseOrgId: job.data.user.organizationId,
      baseUserId: job.data.user.id,
      task: job.data.task,
    });

    this.messageSenderQueue.queue.add('sendTaskUpdateMessage', {
      ...message,
      userEmail: job.data.user.email,
    } as SlackMessageSenderMetadata);
    logger.info({ msg: 'build task status request', data: job.data });
  }
}
