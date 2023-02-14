import { Queue } from 'bullmq';

export interface IQueueConfig {
  prefix: string;
  host: string;
  port: number;
  password: string;
  cluster: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface QueueWrapper<T = any> {
  queue: Queue<T>;
}
