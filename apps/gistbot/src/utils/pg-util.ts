import { logger } from '@base/logger';
import knex, { Knex } from 'knex';

export interface PgConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  synchronize: boolean;
}

export abstract class PgUtil {
  protected db: Knex;
  private synchronize: boolean;

  constructor(cfg: PgConfig) {
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
      await this.synchronizeTables();
    }

    return true;
  }

  abstract synchronizeTables(): Promise<void>;
}
