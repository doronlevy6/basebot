import { logger } from '@base/logger';
import { ImportRefreshJob } from '@base/oapigen';
import {
  createQueue,
  createQueueWorker,
  IQueueConfig,
  QueueWrapper,
} from '@base/queues';
import { Job, Worker } from 'bullmq';
import { PgInstallationStore } from '../installations/installationStore';
import { ImportService } from './service';
import { ImportJob, ImportJobMetadata, ImportTaskType } from './types';

const QUEUE_NAME = 'slackImport';
const REFRESH_QUEUE_NAME = 'slackImportRefresh';

export class ImportController {
  private queueCfg: IQueueConfig;
  private queueWrapper: QueueWrapper;
  private worker: Worker;
  private refreshWorker: Worker<ImportRefreshJob>;
  private importService: ImportService;
  private installationStore: PgInstallationStore;

  constructor(queueCfg: IQueueConfig, installationStore: PgInstallationStore) {
    this.queueCfg = queueCfg;
    this.queueWrapper = createQueue(QUEUE_NAME, queueCfg);
    this.importService = new ImportService(async (name, job) => {
      await this.queueWrapper.queue.add(name, job);
    });
    this.installationStore = installationStore;
  }

  async isReady(): Promise<boolean> {
    this.createWorkers();
    return await this.waitForQueuesReady();
  }

  async close() {
    await this.queueWrapper.queue.close();
    await this.queueWrapper.scheduler.close();
    await this.worker.close();
    await this.refreshWorker.close();
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

    this.refreshWorker = createQueueWorker(
      REFRESH_QUEUE_NAME,
      this.queueCfg,
      async (job: Job<ImportRefreshJob>) => {
        try {
          const installation =
            await this.installationStore.fetchInstallationByBaseId(
              job.data.organization.id,
            );

          const token = installation.bot?.token || '';
          const teamId = installation.team?.id || '';
          this.startImport({
            token,
            slackTeamEmailDomains: [job.data.organization.domain],
            slackTeamId: teamId,
          });
        } catch (error) {
          if (
            (error as Error).message
              .toLowerCase()
              .includes('no installation found')
          ) {
            return;
          }
          throw error;
        }
      },
    );
  }
}
