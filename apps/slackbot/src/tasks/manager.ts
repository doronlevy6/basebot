import { logger } from '@base/logger';
import { TaskMessageDto } from '@base/oapigen';
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
import { IConvStore } from '../db/conv-store';
import { PgInstallationStore } from '../installations/installationStore';
import { SlackMessageSenderMetadata } from './types';
import { TaskView } from './view';

export type MessageBlocks =
  | SectionBlock
  | HeaderBlock
  | ActionsBlock
  | InputBlock
  | ContextBlock;

export class TasksManager {
  private queueCfg: IQueueConfig;
  private taskStatusWorker: Worker;
  private messageSenderWorker: Worker;
  private messageSenderQueue: QueueWrapper;
  private installationStore: PgInstallationStore;
  private convStore: IConvStore;

  constructor(
    queueCfg: IQueueConfig,
    installationStore: PgInstallationStore,
    convStore: IConvStore,
  ) {
    this.queueCfg = queueCfg;
    this.installationStore = installationStore;
    this.convStore = convStore;
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
    await this.taskStatusWorker.close();
    await this.messageSenderWorker.close();
  }

  private async sendMessage(job: Job<SlackMessageSenderMetadata>) {
    try {
      const { channelId, taskId, organizationId, text, blocks } = job.data;
      logger.debug({ msg: 'Sending slack msg', c: channelId, job });

      const installation =
        await this.installationStore.fetchInstallationByBaseId(organizationId);
      const client = new WebClient(installation.bot?.token);

      const postedMsg = await client.chat.postMessage({
        channel: channelId,
        text: text,
        blocks: blocks,
      });

      if (postedMsg && postedMsg.ok && postedMsg.ts) {
        await this.convStore.set(
          {
            taskId,
            baseOrgId: organizationId,
            slackUserId: channelId,
          },
          postedMsg.ts,
        );
      }
      this.sendAnalyticsEvent(job.data);
      logger.info({ msg: 'send task status request', job: job.data });
    } catch (e) {
      logger.error({ msg: 'error sending message', data: job.data, error: e });
    }
  }

  private sendAnalyticsEvent(data: SlackMessageSenderMetadata) {
    if (data.userEmail) {
      AnalyticsManager.getInstance().messageSentToUser(data.userEmail);
    } else {
      logger.warn({ msg: 'No user email found for message analytics' });
    }
  }

  private async requestTaskStatus(job: Job<TaskMessageDto>) {
    logger.debug({ msg: 'requesting task status', data: job.data });

    const installation = await this.installationStore.fetchInstallationByBaseId(
      job.data.user.organizationId,
    );
    const client = new WebClient(installation.bot?.token);

    const lookupByEmails = [
      client.users.lookupByEmail({
        email: job.data.user.email,
      }),
      client.users.lookupByEmail({
        email: job.data.task.creator.email,
      }),
    ];
    job.data.task.owner &&
      lookupByEmails.push(
        client.users.lookupByEmail({
          email: job.data.task.owner.email,
        }),
      );

    const [assigneeRes, creatorRes, ownerRes] = await Promise.all(
      lookupByEmails,
    );

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

    if (
      job.data.task.owner &&
      (ownerRes.error || !ownerRes.user?.id || !ownerRes.ok)
    ) {
      throw new Error(
        `Error getting task owner user by email in slack: ${ownerRes.error}`,
      );
    }

    const message = TaskView({
      assignee: { id: assigneeRes.user.id },
      creator: { id: creatorRes.user.id },
      owner: ownerRes?.user?.id ? { id: ownerRes.user.id } : undefined,
      baseOrgId: job.data.user.organizationId,
      baseUserId: job.data.user.id,
      task: job.data.task,
    });

    await this.messageSenderQueue.queue.add('sendTaskUpdateMessage', {
      ...message,
      userEmail: job.data.user.email,
    } as SlackMessageSenderMetadata);

    logger.info({ msg: 'build task status request', data: job.data });
  }
}
