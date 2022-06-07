import { logger } from '@base/logger';
import { Processor, Queue, Worker } from 'bullmq';
import * as IORedis from 'ioredis';

export interface IQueueConfig {
  prefix: string;
  host: string;
  port: number;
  password: string;
  cluster: boolean;
}

export function createQueue(queueName: string, cfg: IQueueConfig): Queue {
  const connection = createRedis(cfg);

  const queue = new Queue(queueName, {
    prefix: cfg.prefix,
    connection: connection,
  });

  return queue;
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
      { redisOptions: { password: cfg.password } },
    );
  }

  return new IORedis.default({
    host: cfg.host,
    port: cfg.port,
    password: cfg.password,
  });
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
