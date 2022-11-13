import { logger } from '@base/logger';
import { Worker, Queue, QueueScheduler, Processor } from 'bullmq';
import { createRedis } from './redisConfig';
import { IQueueConfig, QueueWrapper } from './types';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createQueueWorker<T = any>(
  queueName: string,
  cfg: IQueueConfig,
  processor: Processor<T>,
): Worker<T> {
  const connection = createRedis(cfg);

  const worker = new Worker(queueName, processor, {
    prefix: cfg.prefix,
    connection: connection,
  });

  worker.on('completed', (job) => {
    logger.info(`completed job ${job.id}`);
  });

  worker.on('failed', (job, error) => {
    logger.error(
      `failed job ${job.id} with error ${error.message}, ${error.stack}`,
    );
  });

  return worker;
}
