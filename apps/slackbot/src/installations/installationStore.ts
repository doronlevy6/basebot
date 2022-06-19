import { logger } from '@base/logger';
import { IReporter } from '@base/metrics';
import {
  Installation,
  InstallationQuery,
  InstallationStore,
} from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import knex, { Knex } from 'knex';

export interface PgConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  synchronize: boolean;
}
export class PgInstallationStore implements InstallationStore {
  private metricsReporter: IReporter;
  private db: Knex;
  private synchronize: boolean;

  constructor(metricsReporter: IReporter, cfg: PgConfig) {
    this.metricsReporter = metricsReporter;
    this.metricsReporter.registerCounter(
      'stored_installations_total',
      'A counter for the number of installations stored',
      ['enterprise'],
    );
    this.metricsReporter.registerCounter(
      'fetched_installations_total',
      'A counter for the number of installations fetched',
      ['enterprise'],
    );
    this.metricsReporter.registerCounter(
      'deleted_installations_total',
      'A counter for the number of installations deleted',
      ['enterprise'],
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
      await this.db
        .raw(`CREATE TABLE IF NOT EXISTS slack_enterprise_installations (
        slack_id varchar(36) NOT NULL,
        base_id varchar(36) NOT NULL UNIQUE,
        raw jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS slack_enterprise_installations_slack_id ON slack_enterprise_installations (slack_id);`);

      await this.db.raw(`CREATE TABLE IF NOT EXISTS slack_installations (
        slack_id varchar(36) NOT NULL,
        base_id varchar(36) NOT NULL UNIQUE,
        raw jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS slack_installations_slack_id ON slack_installations (slack_id);`);
    }

    return true;
  }

  async storeInstallation<AuthVersion extends 'v1' | 'v2'>(
    installation: Installation<AuthVersion, boolean>,
  ): Promise<void> {
    const client = new WebClient(installation.bot.token);
    const teamInfoRes = await client.team.info({});
    if (teamInfoRes.error) {
      throw new Error(
        `Error getting team info in store installation on slack: ${teamInfoRes.error}`,
      );
    }

    if (!teamInfoRes.ok) {
      throw new Error(`Error getting team info in store installation on slack`);
    }

    const domains = teamInfoRes.team.email_domain.split(',');
    let saved = false;
    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];

      if (
        installation.isEnterpriseInstall &&
        installation.enterprise !== undefined
      ) {
        await this.db('slack_enterprise_installations')
          .insert({
            slack_id: installation.enterprise.id,
            base_id: domain,
            raw: installation,
          })
          .onConflict('base_id')
          .merge(['raw', 'slack_id']);
        this.metricsReporter.incrementCounter('stored_installations_total', 1, {
          enterprise: 'true',
        });
        saved = true;
        continue;
      }
      if (installation.team !== undefined) {
        await this.db('slack_installations')
          .insert({
            slack_id: installation.team.id,
            base_id: domain,
            raw: installation,
          })
          .onConflict('base_id')
          .merge(['raw', 'slack_id']);
        this.metricsReporter.incrementCounter('stored_installations_total', 1, {
          enterprise: 'false',
        });

        saved = true;
      }
    }

    if (!saved) {
      throw new Error('Failed saving installation data to installationStore');
    }
  }

  async fetchInstallation(
    query: InstallationQuery<boolean>,
  ): Promise<Installation<'v1' | 'v2', boolean>> {
    if (query.isEnterpriseInstall && query.enterpriseId !== undefined) {
      const res = await this.db
        .select('raw')
        .from('slack_enterprise_installations')
        .where({ slack_id: query.enterpriseId });
      if (!res || res.length == 0) {
        throw new Error('no installation found');
      }

      this.metricsReporter.incrementCounter('fetched_installations_total', 1, {
        enterprise: 'true',
      });
      return res[0].raw as Installation<'v1' | 'v2', boolean>;
    }
    if (query.teamId !== undefined) {
      const res = await this.db
        .select('raw')
        .from('slack_installations')
        .where({ slack_id: query.teamId });
      if (!res || res.length == 0) {
        throw new Error('no installation found');
      }

      this.metricsReporter.incrementCounter('fetched_installations_total', 1, {
        enterprise: 'false',
      });
      return res[0].raw as Installation<'v1' | 'v2', boolean>;
    }
    throw new Error('Failed fetching installation');
  }

  async fetchInstallationByBaseId(
    base_id: string,
  ): Promise<Installation<'v1' | 'v2', boolean>> {
    let enterprise = 'true';
    let res = await this.db
      .select('raw')
      .from('slack_enterprise_installations')
      .where({ base_id: base_id });
    if (!res || res.length == 0) {
      res = await this.db
        .select('raw')
        .from('slack_installations')
        .where({ base_id: base_id });
      enterprise = 'false';
    }
    if (!res || res.length == 0) {
      throw new Error('no installation found');
    }

    this.metricsReporter.incrementCounter('fetched_installations_total', 1, {
      enterprise: enterprise,
    });
    return res[0].raw as Installation<'v1' | 'v2', boolean>;
  }

  async deleteInstallation(query: InstallationQuery<boolean>): Promise<void> {
    if (query.isEnterpriseInstall && query.enterpriseId !== undefined) {
      await this.db('slack_enterprise_installations')
        .where({ slack_id: query.enterpriseId })
        .delete();

      this.metricsReporter.incrementCounter('deleted_installations_total', 1, {
        enterprise: 'true',
      });
      return;
    }
    if (query.teamId !== undefined) {
      await this.db('slack_installations')
        .where({ slack_id: query.teamId })
        .delete();

      this.metricsReporter.incrementCounter('deleted_installations_total', 1, {
        enterprise: 'false',
      });
      return;
    }
    throw new Error('Failed to delete installation');
  }
}
