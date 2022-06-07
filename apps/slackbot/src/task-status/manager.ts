import { logger } from '@base/logger';
import { Job, Worker } from 'bullmq';
import { createQueueWorker, IQueueConfig } from '@base/queues';
import { WebClient } from '@slack/web-api';

interface TaskStatusJob {
  organizationId: string;
  userId: string;
  taskId: string;
}

export class TaskStatusManager {
  private queueCfg: IQueueConfig;
  private taskStatusWorker: Worker;

  constructor(queueCfg: IQueueConfig) {
    this.queueCfg = queueCfg;
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
    const client = new WebClient(''); // TODO: Get Token by org id
    client.chat.postMessage({
      channel: '', // TODO: Get user ID
      text: `An update is requested for task id ${job.data.taskId}`, // TODO: Design
    });
    logger.info({ msg: 'receive task status request', job: job.data });
  }
}
