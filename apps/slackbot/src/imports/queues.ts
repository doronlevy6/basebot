import { logger } from '@base/logger';
import { Processor, Queue, Worker } from 'bullmq';

export interface IQueueConfig {
  prefix: string;
  host: string;
  port: number;
  password: string;
}

export function createQueue(queueName: string, cfg: IQueueConfig): Queue {
  const queue = new Queue(queueName, {
    prefix: cfg.prefix,
    connection: {
      host: cfg.host,
      port: cfg.port,
      password: cfg.password,
      enableOfflineQueue: false,
    },
  });
  return queue;
}

export function createQueueWorker(
  queueName: string,
  cfg: IQueueConfig,
  processor: Processor,
): Worker {
  const worker = new Worker(queueName, processor, {
    prefix: cfg.prefix,
    connection: {
      host: cfg.host,
      port: cfg.port,
      password: cfg.password,
      enableOfflineQueue: false,
    },
  });

  worker.on('completed', (job) => {
    logger.info(`completed job ${job.id}`);
  });

  worker.on('failed', (job, error) => {
    logger.info(`failed job ${job.id} with error ${error.message}`);
  });

  return worker;
}
