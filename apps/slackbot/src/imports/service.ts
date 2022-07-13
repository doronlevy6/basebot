import { logger } from '@base/logger';
import {
  Configuration,
  SlackbotApiApi as SlackbotApi,
  SlackUserDto,
} from '@base/oapigen';
import { WebClient } from '@slack/web-api';
import { Member } from '@slack/web-api/dist/response/UsersListResponse';
import { AxiosError } from 'axios';
import { ImportJob, ImportTaskType } from './types';

type AddJobFunction = (name: string, job: ImportJob) => Promise<void>;
const USERS_PAGINATION_PAGE_SIZE = 200;

export class ImportService {
  private addImportJob: AddJobFunction;
  private client: WebClient;
  private backendApi: SlackbotApi;

  constructor(addImportJob: AddJobFunction) {
    this.addImportJob = addImportJob;
    this.client = new WebClient();
    this.backendApi = new SlackbotApi(
      new Configuration({
        basePath: process.env.BASE_BACKEND_URL,
        accessToken: process.env.BASE_API_KEY,
      }),
    );
  }

  async handleImportJob(job: ImportJob) {
    switch (job.type) {
      case ImportTaskType.Users:
        return this.handleUsersImportJob(job);
      default:
        logger.error('Unknown import task type: ${job.type}');
    }
  }

  private async handleUsersImportJob(job: ImportJob) {
    const {
      cursor,
      metadata: { slackTeamId, token },
    } = job;
    const usersRes = await this.client.users.list({
      limit: USERS_PAGINATION_PAGE_SIZE,
      team_id: slackTeamId,
      token,
      cursor,
    });

    if (usersRes.error) {
      throw new Error(`Error listing users in slack: ${usersRes.error}`);
    }

    if (!usersRes.ok) {
      throw new Error(`Error listing users in slack`);
    }

    const nextCursor = usersRes.response_metadata?.next_cursor;
    if (nextCursor) {
      logger.debug({ msg: 'Fetchin another users cursor', cursor: nextCursor });
      await this.addImportJob(ImportTaskType.Users, {
        ...job,
        cursor: nextCursor,
      });
    }

    if (!usersRes.members) {
      logger.warn('no members found to send to import');
      return;
    }

    await this.sendUsers(usersRes.members, job.metadata.slackTeamEmailDomains);

    logger.debug(`Imported ${usersRes.members.length} users`);
  }

  private async sendUsers(members: Member[], teamDomains: string[]) {
    const users: SlackUserDto[] = members
      .filter((user) => !user.is_bot && user.profile?.email)
      .map((user) => ({
        email: user.profile?.email || '',
        displayName:
          user.profile?.display_name ||
          user.profile?.real_name ||
          user.name ||
          '',
        profileImage: user.profile?.image_512 || '',
        timezoneOffset: user.tz_offset || 0,
      }))
      .filter((user) => user.email); // Post filter to ensure all users have emails

    if (!users.length) {
      logger.debug({ msg: 'All import users filtered out' });
      return;
    }

    try {
      logger.debug({ message: 'sending users to backend', users, teamDomains });
      await this.backendApi.slackbotApiControllerCreate({
        teamDomains,
        users,
      });
    } catch (err) {
      const axErr: AxiosError = err;
      logger.error({
        message: `Failed sending users to backend`,
        code: axErr.code,
        errMsg: axErr.message,
      });

      throw new Error(`Failed sending users to backend`);
    }
  }
}
