import { logger } from '@base/logger';
import { Queue } from 'bullmq';
import { createQueue, IQueueConfig } from './queues';

export class ImportManager {
  private teamsQueue: Queue;
  private usersQueue: Queue;

  constructor(queueCfg: IQueueConfig) {
    this.teamsQueue = createQueue('teams', queueCfg);
    this.usersQueue = createQueue('users', queueCfg);
  }

  async isReady(): Promise<boolean> {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < 10; i++) {
      try {
        await this.teamsQueue.getWorkers();
        await this.usersQueue.getWorkers();
        return true;
      } catch (error) {
        logger.error(`error pinging the queues: ${error}`);
      }
      await delay(1000 * i); // Wait for (number of seconds * loop number) so that we try a few times before giving up
    }

    return false;
  }

  async close() {
    await this.teamsQueue.close();
    await this.usersQueue.close();
  }

  async addTeamImport(teamId: string) {
    await this.teamsQueue.add('teamImport', { teamId: teamId });
  }
}
