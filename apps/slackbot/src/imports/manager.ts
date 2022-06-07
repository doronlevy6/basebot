import { logger } from '@base/logger';
import { DefaultApi } from '@base/oapigen';
import { App } from '@slack/bolt';
import { Job, Worker } from 'bullmq';
import {
  createQueue,
  createQueueWorker,
  IQueueConfig,
  QueueWrapper,
} from '@base/queues';

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
  private queueCfg: IQueueConfig;
  private teamsQueue: QueueWrapper;
  private teamUsersQueue: QueueWrapper;
  private teamsWorker: Worker;
  private teamUsersWorker: Worker;
  private backendApi: DefaultApi;

  constructor(queueCfg: IQueueConfig, backendApi: DefaultApi) {
    this.queueCfg = queueCfg;
    this.backendApi = backendApi;
    this.teamsQueue = createQueue('teams', queueCfg);
    this.teamUsersQueue = createQueue('teamUsers', queueCfg);
  }

  async isReady(app: App): Promise<boolean> {
    this.app = app;

    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    this.teamsWorker = createQueueWorker(
      'teams',
      this.queueCfg,
      async (job) => {
        await this.importTeam(job);
      },
    );
    this.teamUsersWorker = createQueueWorker(
      'teamUsers',
      this.queueCfg,
      async (job) => {
        await this.importTeamUsers(job);
      },
    );

    for (let i = 0; i < 10; i++) {
      try {
        await this.teamsQueue.queue.getWorkers();
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
    await this.teamsQueue.queue.close();
    await this.teamsQueue.scheduler.close();
    await this.teamsWorker.close();
    await this.teamUsersQueue.queue.close();
    await this.teamUsersQueue.scheduler.close();
    await this.teamUsersWorker.close();
  }

  async addTeamToImport(teamId: string, token: string, cursor?: string) {
    await this.teamsQueue.queue.add('teamImport', {
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
    await this.teamUsersQueue.queue.add('teamUsersImport', {
      organizationId: organizationId,
      teamId: teamId,
      token: token,
      cursor: cursor,
    });
  }

  private async importTeam(job: Job<TeamImportJob>) {
    const teamInfoRes = await this.app.client.team.info({
      team: job.data.teamId,
      token: job.data.token,
    });
    if (teamInfoRes.error) {
      throw new Error(`Error getting team info in slack: ${teamInfoRes.error}`);
    }

    if (!teamInfoRes.ok) {
      throw new Error(`Error getting team info in slack`);
    }

    try {
      // TODO: Allow API Key so we can create from Slackbot
      // const orgRes = await this.backendApi.organizationsControllerCreate({
      //   id: teamInfoRes.team.email_domain,
      //   name: teamInfoRes.team.name,
      //   domain: teamInfoRes.team.email_domain,
      // });

      await this.addTeamToUsersImport(
        teamInfoRes.team.email_domain,
        job.data.teamId,
        job.data.token,
      );
    } catch (error) {
      throw new Error(
        `Error creating organization in backend with error ${error}`,
      );
    }
  }

  private async importTeamUsers(job: Job<TeamUserImportJob>) {
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
      logger.info({ msg: 'importing user', user: user });

      if (user.is_bot || !user.profile.email) {
        logger.info({ msg: 'skipping user with no email', user: user });
        continue;
      }

      // TODO: Allow API Key so we can create from Slackbot
      // try {
      //   await this.backendApi.usersControllerCreate({
      //     email: user.profile.email,
      //     displayName: user.profile.display_name || user.profile.real_name,
      //     organizationId: job.data.organizationId,
      //   });
      // } catch (error) {
      //   throw new Error(
      //     `Error creating user ${user.id} in backend with error ${error}`,
      //   );
      // }
    }
  }

  private orgIdFromEmail(email: string) {
    return email.split('@').pop();
  }
}
