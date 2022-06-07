import { logger } from '@base/logger';
import { App } from '@slack/bolt';
import { Job, Queue, Worker } from 'bullmq';
import { createQueue, createQueueWorker, IQueueConfig } from './queues';

interface TeamImportJob {
  teamId: string;
  token: string;
  cursor?: string;
}

export class ImportManager {
  private app: App;
  private teamsQueue: Queue;
  private teamsWorker: Worker;

  constructor(queueCfg: IQueueConfig) {
    this.teamsQueue = createQueue('teams', queueCfg);

    this.teamsWorker = createQueueWorker(
      'teams',
      queueCfg,
      async (job: Job<TeamImportJob>) => {
        const usersRes = await this.app.client.users.list({
          limit: 200,
          token: job.data.token,
          cursor: job.data.cursor,
        });

        if (usersRes.error) {
          throw new Error(`Error listing users in slack: ${usersRes.error}`);
        }

        if (!usersRes.ok) {
          throw new Error(`Error listing users in slack`);
        }

        const nextCursor = usersRes.response_metadata?.next_cursor;
        if (nextCursor) {
          await this.addTeamToImport(
            job.data.teamId,
            job.data.token,
            nextCursor,
          );
        }

        for (let index = 0; index < usersRes.members.length; index++) {
          // TODO: Create users
          logger.info(usersRes.members[index]);
        }
      },
    );
  }

  setSlackClient(app: App) {
    this.app = app;
  }

  async isReady(): Promise<boolean> {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < 10; i++) {
      try {
        await this.teamsQueue.getWorkers();
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
    await this.teamsWorker.close();
  }

  async addTeamToImport(teamId: string, token: string, cursor?: string) {
    await this.teamsQueue.add('teamImport', {
      teamId: teamId,
      token: token,
      cursor: cursor,
    });
  }
}
