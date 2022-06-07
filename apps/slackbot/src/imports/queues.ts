import { logger } from '@base/logger';
import { Processor, Queue, QueueScheduler, Worker } from 'bullmq';
import * as IORedis from 'ioredis';

export interface IQueueConfig {
  prefix: string;
  host: string;
  port: number;
  password: string;
  cluster: boolean;
}

export interface QueueWrapper {
  queue: Queue;
  scheduler: QueueScheduler;
}

export function createQueue(
  queueName: string,
  cfg: IQueueConfig,
): QueueWrapper {
  const connection = createRedis(cfg);

  const queue = new Queue(queueName, {
    prefix: cfg.prefix,
    connection: connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  });

  const queueScheduler = new QueueScheduler(queueName, {
    prefix: cfg.prefix,
    connection: connection,
  });

  return { queue: queue, scheduler: queueScheduler };
}

export function createQueueWorker(
  queueName: string,
  cfg: IQueueConfig,
  processor: Processor,
): Worker {
  const connection = createRedis(cfg);

  const worker = new Worker(queueName, processor, {
    prefix: cfg.prefix,
    connection: connection,
  });

  worker.on('completed', (job) => {
    logger.info(`completed job ${job.id}`);
  });

  worker.on('failed', (job, error) => {
    logger.error(`failed job ${job.id} with error ${error.message}`);
  });

  return worker;
}

function createRedis(cfg: IQueueConfig): IORedis.Redis | IORedis.Cluster {
  if (cfg.cluster) {
    return new IORedis.Cluster(
      [
        {
          host: cfg.host,
          port: cfg.port,
        },
      ],
      {
        redisOptions: { password: cfg.password, maxRetriesPerRequest: null },
        enableOfflineQueue: false,
      },
    );
  }

  return new IORedis.default({
    host: cfg.host,
    port: cfg.port,
    password: cfg.password,
    enableOfflineQueue: false,
    maxRetriesPerRequest: null,
  });
}
