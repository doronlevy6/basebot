import { logger } from '@base/logger';
import knex, { Knex } from 'knex';
import { PgConfig } from '../installations/installationStore';
import { ConvKey, IConvStore } from './conv-store';

export class SqlConvStore implements IConvStore {
  private db: Knex;
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
      await this.db.raw(
        `CREATE TABLE IF NOT EXISTS slack_conversations (
                    "organizationId" varchar(36) NOT NULL,
                    "messageTs" varchar(36) NOT NULL,
                    "taskId" varchar(36) NOT NULL,
                    "slackUserId" varchar(36) NOT NULL,
                    
                    PRIMARY KEY ("taskId", "organizationId", "slackUserId")
                );
                `,
      );
    }

    return true;
  }

  async get(convKey: ConvKey): Promise<string | undefined> {
    try {
      const res = await this.db
        .select('messageTs')
        .from('slack_conversations')
        .where({
          taskId: convKey.taskId,
          organizationId: convKey.baseOrgId,
          slackUserId: convKey.slackUserId,
        });
      if (!res || res.length == 0) {
        return undefined;
      }
      return res[0].messageTs;
    } catch (ex) {
      logger.error(`error in fetching message ts from db: ${ex}`);
      throw ex;
    }
  }

  async set(convKey: ConvKey, value: string): Promise<void> {
    try {
      await this.db('slack_conversations')
        .insert({
          taskId: convKey.taskId,
          organizationId: convKey.baseOrgId,
          slackUserId: convKey.slackUserId,
          messageTs: value,
        })
        .onConflict(['taskId', 'organizationId', 'slackUserId'])
        .merge(['messageTs']);
    } catch (ex) {
      logger.error(`error in saving message ts to db: ${ex}`);
      throw ex;
    }
  }
}
