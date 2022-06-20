import { logger } from '@base/logger';
import { Job, Worker } from 'bullmq';
import {
  createQueue,
  createQueueWorker,
  IQueueConfig,
  QueueWrapper,
} from '@base/queues';
import {
  ActionsBlock,
  Button,
  HeaderBlock,
  PlainTextOption,
  SectionBlock,
  UsersLookupByEmailResponse,
  WebClient,
} from '@slack/web-api';
import { PgInstallationStore } from '../installations/installationStore';
import { Task, User } from '@base/oapigen';
import { TaskStatuses } from './types';

interface TaskStatusJob {
  user: User;
  task: Task;
}

interface UpdateMessage {
  organizationId: string;
  channelId: string;
  text: string;
  blocks: MessageBlocks[];
}

type MessageBlocks = SectionBlock | HeaderBlock | ActionsBlock;

export class TaskStatusManager {
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

    this.messageSenderQueue = createQueue('sendUpdateMessage', this.queueCfg);

    this.messageSenderWorker = createQueueWorker(
      'sendUpdateMessage',
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

  private async sendMessage(job: Job<UpdateMessage>) {
    const installation = await this.installationStore.fetchInstallationByBaseId(
      job.data.organizationId,
    );
    const client = new WebClient(installation.bot.token);
    client.chat.postMessage({
      channel: job.data.channelId,
      text: job.data.text,
      blocks: job.data.blocks,
    });
    logger.info({ msg: 'send task status request', job: job.data });
  }

  private async requestTaskStatus(job: Job<TaskStatusJob>) {
    const installation = await this.installationStore.fetchInstallationByBaseId(
      job.data.user.organizationId,
    );

    const client = new WebClient(installation.bot.token);
    const assigneeSlackUserRes = await client.users.lookupByEmail({
      email: job.data.user.email,
    });
    if (assigneeSlackUserRes.error) {
      throw new Error(
        `Error getting assigned user by email in slack: ${assigneeSlackUserRes.error}`,
      );
    }

    if (!assigneeSlackUserRes.ok) {
      throw new Error(`Error getting assigned user by email in slack`);
    }

    const taskCreatorSlackUserRes = await client.users.lookupByEmail({
      email: job.data.task.creator.email,
    });
    if (taskCreatorSlackUserRes.error) {
      throw new Error(
        `Error getting task creator user by email in slack: ${taskCreatorSlackUserRes.error}`,
      );
    }

    if (!taskCreatorSlackUserRes.ok) {
      throw new Error(`Error getting task creator user by email in slack`);
    }

    const message: UpdateMessage = {
      organizationId: job.data.user.organizationId,
      channelId: assigneeSlackUserRes.user.id,
      text: `Hi ${job.data.user.displayName}, you have a task status update request!`,
      blocks: this.getFormattedBlocks(
        assigneeSlackUserRes,
        taskCreatorSlackUserRes,
        job.data.user.id,
        job.data.user.organizationId,
        job.data.task,
        TaskStatuses,
      ),
    };

    const delayMilli = assigneeSlackUserRes.user.tz_offset
      ? this.calculateDelayMilli(assigneeSlackUserRes.user.tz_offset)
      : 0; // If we don't have a TZ then we just use no delay
    this.messageSenderQueue.queue.add('sendUpdateMessage', message, {
      delay: delayMilli,
    });
    logger.info({ msg: 'build task status request', job: job.data });
  }

  private calculateDelayMilli(tz_offset_seconds: number): number {
    const tz_offset_milli = tz_offset_seconds * 1000;
    const now = new Date();
    const nowInTz = new Date(+now + tz_offset_milli);

    if (nowInTz.getUTCHours() > 10 && nowInTz.getUTCHours() < 19) {
      // 10-19 is working hours kind of
      // If we are in working hours we should just send with no delay
      return 0;
    }

    let dateDay = nowInTz.getUTCDate();
    if (nowInTz.getUTCHours() > 19) {
      // If we are late in the day, wait until tomorrow
      dateDay = nowInTz.getUTCDate() + 1;
    }

    const startOfNextWorkingHours = new Date(
      Date.UTC(
        nowInTz.getUTCFullYear(),
        nowInTz.getUTCMonth(),
        dateDay,
        10,
        0,
        0,
        0,
      ),
    );

    return +startOfNextWorkingHours - +nowInTz;
  }

  private getFormattedBlocks(
    assignedUserRes: UsersLookupByEmailResponse,
    taskCreatorUserRes: UsersLookupByEmailResponse,
    baseUser: string,
    baseOrg: string,
    task: Task,
    taskStatuses: string[],
  ): MessageBlocks[] {
    const statusesOptions = taskStatuses.map((status) => {
      const option: PlainTextOption = {
        text: {
          type: 'plain_text',
          text: status,
        },
        value: JSON.stringify({
          organizationId: baseOrg,
          assigneeId: baseUser,
          taskId: task.id,
          status: status,
        }),
      };
      return option;
    });

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Hi <@${assignedUserRes.user.id}>, you have a task status update request! <@${taskCreatorUserRes.user.id}> created this task for you which is due in X days/weeks.`,
        },
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Task',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Due Date:*\n${task.dueDate}`,
          },
          {
            type: 'mrkdwn',
            text: `*Title:*\n${task.title}`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n${task.status}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'What is the current status of this task?',
        },
        accessory: {
          type: 'overflow',
          options: statusesOptions,
          action_id: 'task-status-select',
        },
      },
    ];
  }
}
