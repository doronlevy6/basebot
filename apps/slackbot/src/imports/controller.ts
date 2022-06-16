import { logger } from '@base/logger';
import {
  createQueue,
  createQueueWorker,
  IQueueConfig,
  QueueWrapper,
} from '@base/queues';
import { Worker } from 'bullmq';
import { ImportService } from './service';
import { ImportJob, ImportJobMetadata, ImportTaskType } from './types';

const QUEUE_NAME = 'slackImport';

export class ImportController {
  private queueCfg: IQueueConfig;
  private queueWrapper: QueueWrapper;
  private worker: Worker;
  private importService: ImportService;

  constructor(queueCfg: IQueueConfig) {
    this.queueCfg = queueCfg;
    this.queueWrapper = createQueue(QUEUE_NAME, queueCfg);
    this.importService = new ImportService(async (name, job) => {
      await this.queueWrapper.queue.add(name, job);
    });
  }

  async isReady(): Promise<boolean> {
    this.createWorkers();
    return await this.waitForQueuesReady();
  }

  async close() {
    await this.queueWrapper.queue.close();
    await this.queueWrapper.scheduler.close();
    await this.worker.close();
  }

  async startImport(metadata: ImportJobMetadata) {
    const job: ImportJob = {
      metadata,
      type: ImportTaskType.Users,
    };

    await this.queueWrapper.queue.add(ImportTaskType.Users, job);
  }

  private async waitForQueuesReady() {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < 10; i++) {
      try {
        await this.queueWrapper.queue.getWorkers();
        return true;
      } catch (error) {
        logger.error(`error pinging the queues: ${error}`);
      }
      await delay(1000 * i); // Wait for (number of seconds * loop number) so that we try a few times before giving up
    }

    return false;
  }

  private createWorkers() {
    this.worker = createQueueWorker(QUEUE_NAME, this.queueCfg, async (job) => {
      await this.importService.handleImportJob(job.data);
    });
  }
}
