import { logger } from '@base/logger';
import { PgUtil } from '@base/utils';
import { GmailDigest } from '../email-for-slack/types';
import { IHomeState } from './types';

const TABLE_NAME = `gistbot_home_data_store`;
interface IPrimaryKey {
  slackUserId: string;
  slackTeamId: string;
}

export type HomeData = Omit<IHomeState, 'slackOnboarded'>;

interface ITableData {
  slack_team_id: string;
  slack_user_id: string;
  email_connected: Date;
  email_digest: string;
  email_digest_last_updated: Date;
}

export class HomeDataStore extends PgUtil {
  async synchronizeTables(): Promise<void> {
    await this.db.raw(`CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        slack_team_id varchar(36) NOT NULL,
        slack_user_id varchar(36) NOT NULL,
        email_connected timestamp default null,
        email_digest jsonb,
        email_digest_last_updated timestamp,
        PRIMARY KEY ("slack_team_id", "slack_user_id")
      );
    `);
  }

  async updateEmailDigest(
    { slackTeamId, slackUserId }: IPrimaryKey,
    digest: object,
  ): Promise<void> {
    await this.db<ITableData>(TABLE_NAME)
      .insert({
        slack_team_id: slackTeamId,
        slack_user_id: slackUserId,
        email_digest: JSON.stringify(digest),
        email_digest_last_updated: new Date(),
      })
      .onConflict(['slack_team_id', 'slack_user_id'])
      .merge();
  }

  async updateGmailConnectionStatus(
    { slackTeamId, slackUserId }: IPrimaryKey,
    connectedSince: Date,
  ): Promise<void> {
    console.debug(
      'updateGmailConnectionStatus',
      connectedSince,
      slackTeamId,
      slackUserId,
    );
    await this.db<ITableData>(TABLE_NAME)
      .insert({
        slack_team_id: slackTeamId,
        slack_user_id: slackUserId,
        email_connected: connectedSince,
      })
      .onConflict(['slack_team_id', 'slack_user_id'])
      .merge(['slack_team_id', 'slack_user_id']);
  }

  async fetch({
    slackTeamId,
    slackUserId,
  }: IPrimaryKey): Promise<HomeData | undefined> {
    logger.debug(`fetching home data for ${slackUserId}`);
    const res = await this.db
      .select<ITableData[]>('*')
      .from(TABLE_NAME)
      .where({ slack_team_id: slackTeamId, slack_user_id: slackUserId });

    if (!res || res.length == 0) {
      logger.debug(`No home data for ${slackUserId}`);
      return;
    }

    const { email_connected, email_digest, email_digest_last_updated } = res[0];
    if (!email_digest) {
      return {
        gmailConnected: email_connected,
      };
    }

    return {
      gmailConnected: email_connected,
      gmailDigest: {
        digest: email_digest as unknown as GmailDigest,
        lastUpdated: new Date(email_digest_last_updated).getTime(),
      },
    };
  }
}
