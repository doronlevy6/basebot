import { logger } from '@base/logger';
import { Task, User } from '@base/oapigen';
import { createQueue, IQueueConfig, QueueWrapper } from '@base/queues';

export class TaskStatusTriggerer {
  private taskStatusQueue: QueueWrapper;

  constructor(queueCfg: IQueueConfig) {
    this.taskStatusQueue = createQueue('taskStatus', queueCfg);
  }

  async isReady(): Promise<boolean> {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < 10; i++) {
      try {
        await this.taskStatusQueue.queue.getWorkers();
        return true;
      } catch (error) {
        logger.error(`error pinging the queues: ${error}`);
      }
      await delay(1000 * i); // Wait for (number of seconds * loop number) so that we try a few times before giving up
    }

    return false;
  }

  async close() {
    await this.taskStatusQueue.queue.close();
    await this.taskStatusQueue.scheduler.close();
  }

  async addTaskToQueue(user: User, task: Task, firstTimeAsking: boolean) {
    await this.taskStatusQueue.queue.add('taskStatusRequest', {
      user: user,
      task: task,
      firstTimeAsking: firstTimeAsking,
    });
  }
}
