import { PgUtil, PgConfig } from '@base/utils';
import { Session } from './types';

export interface SessionDataStore {
  storeSession(sessionId: string, session: Session): Promise<void>;
  storeSessionFeedback(props: {
    sessionId: string;
    teamId: string;
    userId: string;
    feedback: string;
  }): Promise<void>;
  fetchSession(props: { sessionId: string; teamId: string }): Promise<Session>;
  fetchSessionFeedbacks(props: {
    sessionId: string;
    teamId: string;
  }): Promise<Record<string, number>>;
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

  async fetchSession({
    sessionId,
    teamId,
  }: {
    sessionId: string;
    teamId: string;
  }): Promise<Session> {
    const res = await this.db
      .select('session_data')
      .from('gistbot_session_data_store')
      .where({ session_id: sessionId, slack_team_id: teamId });
    if (!res || res.length == 0) {
      throw new Error('no session found');
    }

    return res[0].session_data as Session;
  }

  async fetchSessionFeedbacks({
    sessionId,
    teamId,
  }: {
    sessionId: string;
    teamId: string;
  }): Promise<Record<string, number>> {
    const res = await this.db
      .select('feedback')
      .count('slack_team_id', 'slack_user_id')
      .groupBy('feedback')
      .from('gistbot_session_feedbacks_store')
      .where({ session_id: sessionId, slack_team_id: teamId });
    if (!res || res.length == 0) {
      throw new Error('no session found');
    }

    const counts = res.reduce((acc, curr) => {
      if (acc[curr['feedback']]) {
        acc[curr['feedback']] += parseInt(curr['count'], 10);
        return acc;
      }

      acc[curr['feedback']] = parseInt(curr['count'], 10);
      return acc;
    }, {}) as Record<string, number>;

    return counts;
  }
}
