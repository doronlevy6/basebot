import { Queue, QueueScheduler } from 'bullmq';

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
