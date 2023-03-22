import { logger } from '@base/logger';
import { PgUtil } from '@base/utils';
import { GmailDigest } from '../email-for-slack/types';
import { IEmailRefreshMetadata, IHomeState } from './types';

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
  email_enabled: boolean;
  onboarding_message: string;
  email_digest: string;
  email_digest_last_updated: Date;
  email_digest_refresh_metadata: string;
}

export class HomeDataStore extends PgUtil {
  async synchronizeTables(): Promise<void> {
    await this.db.raw(`CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        slack_team_id varchar(36) NOT NULL,
        slack_user_id varchar(36) NOT NULL,
        email_connected timestamp default null,
        email_enabled boolean default TRUE,
        onboarding_message text,
        email_digest jsonb,
        email_digest_last_updated timestamp,
        email_digest_refresh_metadata jsonb,
        PRIMARY KEY ("slack_team_id", "slack_user_id")
      );

      Alter table ${TABLE_NAME}
      Add column IF NOT EXISTS email_digest_refresh_metadata jsonb,
      Add column IF NOT EXISTS email_enabled boolean default TRUE,
      Add column IF NOT EXISTS onboarding_message text
    `);
  }

  async disconnectEmail({ slackTeamId, slackUserId }): Promise<void> {
    await this.db(TABLE_NAME)
      .update({ email_enabled: false })
      .where({ slack_team_id: slackTeamId, slack_user_id: slackUserId });
  }

  async updateEmailDigest(
    { slackTeamId, slackUserId }: IPrimaryKey,
    digest: object,
    email_digest_refresh_metadata?: '{}',
    onboarding_message?: string,
  ): Promise<void> {
    const dataToInsert: Partial<ITableData> = {
      slack_team_id: slackTeamId,
      slack_user_id: slackUserId,
      email_digest: JSON.stringify(digest),
      email_digest_last_updated: new Date(),
      email_digest_refresh_metadata: email_digest_refresh_metadata,
    };

    if (onboarding_message) {
      dataToInsert.onboarding_message = onboarding_message;
    }
    await this.db<ITableData>(TABLE_NAME)
      .insert(dataToInsert)
      .onConflict(['slack_team_id', 'slack_user_id'])
      .merge();
  }

  async updateEmailRefreshMetadata(
    { slackTeamId, slackUserId }: IPrimaryKey,
    refreshMetadata: IEmailRefreshMetadata,
  ): Promise<void> {
    await this.db<ITableData>(TABLE_NAME)
      .insert({
        slack_team_id: slackTeamId,
        slack_user_id: slackUserId,
        email_digest_refresh_metadata: JSON.stringify(refreshMetadata),
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
    await this.db.raw(
      `INSERT INTO gistbot_home_data_store (slack_user_id, slack_team_id,email_connected, email_enabled)
        VALUES (:slack_user_id, :slack_team_id,:email_connected, TRUE)
        ON CONFLICT(slack_team_id,slack_user_id) DO UPDATE
        SET
          email_connected = COALESCE(gistbot_home_data_store.email_connected, excluded.email_connected),
          email_enabled = excluded.email_enabled;`,
      {
        slack_team_id: slackTeamId,
        slack_user_id: slackUserId,
        email_connected: connectedSince,
      },
    );
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

    const {
      email_connected,
      email_enabled,
      email_digest,
      email_digest_last_updated,
      email_digest_refresh_metadata,
      onboarding_message,
    } = res[0];

    const gmailRefreshMetadata =
      email_digest_refresh_metadata as unknown as IEmailRefreshMetadata;

    if (!email_digest) {
      return {
        gmailConnected: email_connected,
        gmailRefreshMetadata,
        emailEnabled: email_enabled,
      };
    }

    return {
      gmailConnected: email_connected,
      emailEnabled: email_enabled,
      gmailDigest: {
        digest: email_digest as unknown as GmailDigest,
        lastUpdated: new Date(email_digest_last_updated).getTime(),
      },
      gmailRefreshMetadata,
      onBoardingMessage: onboarding_message,
    };
  }

  async dismissOnboarding(slackUserId: string, slackTeamId: string) {
    await this.db(TABLE_NAME)
      .update({ onboarding_message: null })
      .where({ slack_team_id: slackTeamId, slack_user_id: slackUserId });
  }
}
