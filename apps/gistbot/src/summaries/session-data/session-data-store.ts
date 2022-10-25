import { PgUtil, PgConfig } from '../../utils/pg-util';

export type Session = ChannelSummarySession | ThreadSummarySession;

interface ChannelSummarySession {
  summaryType: 'channel';
  teamId: string;
  channelId: string;
  requestingUserId: string;
  request: {
    channel_name: string;
    threads: {
      messageIds: string[];
      userIds: string[];
      reactions: number[];
    }[];
  };
  response: string;
}

interface ThreadSummarySession {
  summaryType: 'thread';
  teamId: string;
  channelId: string;
  requestingUserId: string;
  threadTs: string;
  request: {
    channel_name: string;
    messageIds: string[];
    userIds: string[];
    reactions: number[];
  };
  response: string;
}

export interface SessionDataStore {
  storeSession(sessionId: string, session: Session): Promise<void>;
  storeSessionFeedback(props: {
    sessionId: string;
    teamId: string;
    userId: string;
    feedback: string;
  }): Promise<void>;
}

export class PgSessionDataStore extends PgUtil implements SessionDataStore {
  constructor(cfg: PgConfig) {
    super(cfg);
  }

  async synchronizeTables() {
    await this.db.raw(`CREATE TABLE IF NOT EXISTS gistbot_session_data_store (
      session_id varchar(36) NOT NULL,
      slack_team_id varchar(36) NOT NULL,
      summary_type varchar(36) NOT NULL,
      session_data jsonb NOT NULL,
      created_at_unix bigint NOT NULL,
      PRIMARY KEY ("session_id", "slack_team_id")
    );`);

    await this.db
      .raw(`CREATE TABLE IF NOT EXISTS gistbot_session_feedbacks_store (
      session_id varchar(36) NOT NULL,
      slack_team_id varchar(36) NOT NULL,
      slack_user_id varchar(36) NOT NULL,
      feedback varchar(36) NOT NULL,
      created_at_unix bigint NOT NULL,
      updated_at_unix bigint NOT NULL,
      PRIMARY KEY ("session_id", "slack_team_id", "slack_user_id")
    );`);
  }

  async storeSession(sessionId: string, session: Session): Promise<void> {
    await this.db('gistbot_session_data_store')
      .insert({
        session_id: sessionId,
        slack_team_id: session.teamId,
        summary_type: session.summaryType,
        session_data: session,
        created_at_unix: Math.floor(new Date().getTime() / 1000),
      })
      .onConflict(['session_id', 'slack_team_id'])
      .ignore();
  }

  async storeSessionFeedback({
    sessionId,
    teamId,
    userId,
    feedback,
  }: {
    sessionId: string;
    teamId: string;
    userId: string;
    feedback: string;
  }): Promise<void> {
    await this.db('gistbot_session_feedbacks_store')
      .insert({
        session_id: sessionId,
        slack_team_id: teamId,
        slack_user_id: userId,
        feedback: feedback,
        created_at_unix: Math.floor(new Date().getTime() / 1000),
        updated_at_unix: Math.floor(new Date().getTime() / 1000),
      })
      .onConflict(['session_id', 'slack_team_id', 'slack_user_id'])
      .merge(['feedback', 'updated_at_unix']);
  }
}
