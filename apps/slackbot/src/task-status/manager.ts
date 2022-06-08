import { logger } from '@base/logger';
import { Job, Worker } from 'bullmq';
import { createQueueWorker, IQueueConfig } from '@base/queues';
import {
  ActionsBlock,
  Button,
  HeaderBlock,
  SectionBlock,
  UsersLookupByEmailResponse,
  WebClient,
} from '@slack/web-api';
import { PgInstallationStore } from '../installations/installationStore';
import { Task, User } from '@base/oapigen';
import { TaskStatus } from './types';

interface TaskStatusJob {
  user: User;
  task: Task;
}

type MessageBlocks = SectionBlock | HeaderBlock | ActionsBlock;

export class TaskStatusManager {
  private queueCfg: IQueueConfig;
  private taskStatusWorker: Worker;
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

    for (let i = 0; i < 10; i++) {
      try {
        await (await this.taskStatusWorker.client).ping();
        return true;
      } catch (error) {
        logger.error(`error pinging the queues: ${error}`);
      }
      await delay(1000 * i); // Wait for (number of seconds * loop number) so that we try a few times before giving up
    }

    return false;
  }

  async close() {
    await this.taskStatusWorker.close();
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

    client.chat.postMessage({
      channel: assigneeSlackUserRes.user.id,
      text: `Hi ${job.data.user.displayName}, you have a task status update request!`,
      blocks: this.getFormattedBlocks(
        assigneeSlackUserRes,
        taskCreatorSlackUserRes,
        job.data.user.id,
        job.data.user.organizationId,
        job.data.task,
        [
          TaskStatus.Reassigned,
          TaskStatus.NotStarted,
          TaskStatus.InProgress,
          TaskStatus.Done,
        ],
      ),
    });
    logger.info({ msg: 'receive task status request', job: job.data });
  }

  private getFormattedBlocks(
    assignedUserRes: UsersLookupByEmailResponse,
    taskCreatorUserRes: UsersLookupByEmailResponse,
    baseUser: string,
    baseOrg: string,
    task: Task,
    value: string[],
  ): MessageBlocks[] {
    const buttons = value.map((val) => {
      const button: Button = {
        type: 'button',
        text: {
          type: 'plain_text',
          text: val,
          emoji: true,
        },
        value: JSON.stringify([baseOrg, baseUser, val]),
        action_id: val,
      };
      return button;
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
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'What is the current status of this task?',
        },
      },
      {
        type: 'actions',
        elements: buttons,
      },
    ];
  }
}
