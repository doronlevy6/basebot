import { logger } from '@base/logger';
import { IReporter } from '@base/metrics';
import knex, { Knex } from 'knex';

export interface OnboardingStore {
  userOnboarded(teamId: string, userId: string): Promise<void>;
  wasUserOnboarded(teamId: string, userId: string): Promise<boolean>;
}

export interface PgConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  synchronize: boolean;
}

export class PgOnboardingStore implements OnboardingStore {
  private metricsReporter: IReporter;
  private db: Knex;
  private synchronize: boolean;

  constructor(metricsReporter: IReporter, cfg: PgConfig) {
    this.metricsReporter = metricsReporter;
    this.metricsReporter.registerCounter(
      'onboarded_users_total',
      'A counter for the number of users onboarded',
      [],
    );
    this.db = knex({
      client: 'pg',
      connection: {
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
      },
    });
    this.synchronize = cfg.synchronize;
  }

  async isReady(): Promise<boolean> {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    let connected = false;
    for (let i = 0; i < 10; i++) {
      try {
        await this.db.raw('SELECT now()');
        connected = true;
        break;
      } catch (error) {
        logger.error(`error pinging the database: ${error}`);
      }
      await delay(1000 * i); // Wait for (number of seconds * loop number) so that we try a few times before giving up
    }

    if (!connected) {
      return false;
    }

    if (this.synchronize) {
      logger.info('attempting to synchronize tables');
      await this.db.raw(`CREATE TABLE IF NOT EXISTS gistbot_user_onboardings (
        slack_team_id varchar(36) NOT NULL,
        slack_user_id varchar(36) NOT NULL,
        PRIMARY KEY ("slack_team_id", "slack_user_id")
      );`);
    }

    return true;
  }

  async userOnboarded(teamId: string, userId: string): Promise<void> {
    await this.db('gistbot_user_onboardings')
      .insert({
        slack_team_id: teamId,
        slack_user_id: userId,
      })
      .onConflict(['slack_team_id', 'slack_user_id'])
      .ignore();
    this.metricsReporter.incrementCounter('onboarded_users_total', 1, {});
  }

  async wasUserOnboarded(teamId: string, userId: string): Promise<boolean> {
    const res = await this.db
      .select(1)
      .from('gistbot_user_onboardings')
      .where({ slack_team_id: teamId, slack_user_id: userId });
    if (!res || res.length == 0) {
      return false;
    }
    return true;
  }
}
