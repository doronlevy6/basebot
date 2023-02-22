import { logger } from '@base/logger';
import {
  createQueue,
  createQueueWorker,
  IQueueConfig,
  QueueWrapper,
} from '@base/queues';
import { Job, Worker } from 'bullmq';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export abstract class BullMQUtil<T> {
  protected worker: Worker<T>;
  protected queue: QueueWrapper<T>;

  constructor(private queueName: string, private queueCfg: IQueueConfig) {
    this.worker = createQueueWorker<T>(queueName, queueCfg, async (job) => {
      await this.handleMessage(job);
    });

    this.queue = createQueue(queueName, queueCfg);
  }

  async isReady(): Promise<boolean> {
    for (let i = 0; i < 10; i++) {
      try {
        await (await this.worker.client).ping();
        await this.queue.queue.getWorkers();
        return true;
      } catch (error) {
        logger.error(`error pinging the queues: ${error}`);
      }
      await delay(1000 * i); // Wait for (number of seconds * loop number) so that we try a few times before giving up
    }

    return false;
  }

  async close() {
    await this.queue.queue.close();
    await this.worker.close();
  }

  abstract handleMessage(message: Job<T>): Promise<void>;
}
