import { logger } from '@base/logger';
import { DefaultApi } from '@base/oapigen';
import { App } from '@slack/bolt';
import { Job, Queue, Worker } from 'bullmq';
import { createQueue, createQueueWorker, IQueueConfig } from './queues';

interface ImportJob {
  token: string;
  cursor?: string;
}

interface TeamImportJob extends ImportJob {
  teamId: string;
}

interface TeamUserImportJob extends TeamImportJob {
  organizationId: string;
}

export class ImportManager {
  private app: App;
  private teamsQueue: Queue;
  private teamUsersQueue: Queue;
  private teamsWorker: Worker;
  private teamUsersWorker: Worker;
  private backendApi: DefaultApi;

  constructor(queueCfg: IQueueConfig, backendApi: DefaultApi) {
    this.backendApi = backendApi;
    this.teamsQueue = createQueue('teams', queueCfg);
    this.teamUsersQueue = createQueue('teamUsers', queueCfg);

    this.teamsWorker = createQueueWorker(
      'teams',
      queueCfg,
      async (job: Job<TeamImportJob>) => {
        const teamInfoRes = await this.app.client.team.info({
          team: job.data.teamId,
          token: job.data.token,
        });
        if (teamInfoRes.error) {
          throw new Error(
            `Error getting team info in slack: ${teamInfoRes.error}`,
          );
        }

        if (!teamInfoRes.ok) {
          throw new Error(`Error getting team info in slack`);
        }

        const orgRes = await this.backendApi.organizationsControllerCreate({
          id: teamInfoRes.team.email_domain,
          name: teamInfoRes.team.name,
          domain: teamInfoRes.team.email_domain,
        });

        await this.addTeamToUsersImport(
          orgRes.data.id,
          job.data.teamId,
          job.data.token,
        );
      },
    );

    this.teamUsersWorker = createQueueWorker(
      'teamUsers',
      queueCfg,
      async (job: Job<TeamUserImportJob>) => {
        const usersRes = await this.app.client.users.list({
          limit: 200,
          team_id: job.data.teamId,
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
          await this.addTeamToUsersImport(
            job.data.organizationId,
            job.data.teamId,
            job.data.token,
            nextCursor,
          );
        }

        for (let index = 0; index < usersRes.members.length; index++) {
          const user = usersRes.members[index];
          logger.info(`Importing User: ${user}`);
          this.backendApi.usersControllerCreate({
            email: user.profile.email,
            displayName: user.profile.display_name || user.profile.real_name,
            organizationId: this.orgIdFromEmail(user.profile.email),
          });
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
        await this.backendApi.healthControllerCheck();
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

  async addTeamToUsersImport(
    organizationId: string,
    teamId: string,
    token: string,
    cursor?: string,
  ) {
    await this.teamUsersQueue.add('teamUsersImport', {
      organizationId: organizationId,
      teamId: teamId,
      token: token,
      cursor: cursor,
    });
  }

  private orgIdFromEmail(email: string) {
    return email.split('@').pop();
  }
}
