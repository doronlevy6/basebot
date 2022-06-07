import { logger } from '@base/logger';
import { IReporter } from '@base/metrics';
import {
  Installation,
  InstallationQuery,
  InstallationStore,
} from '@slack/bolt';
import knex, { Knex } from 'knex';
import { ImportManager } from '../imports/manager';

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
  private importManager: ImportManager;

  constructor(
    metricsReporter: IReporter,
    cfg: PgConfig,
    importMananger: ImportManager,
  ) {
    this.importManager = importMananger;
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
        id varchar(36) NOT NULL PRIMARY KEY,
        raw jsonb NOT NULL
      );`);

      await this.db.raw(`CREATE TABLE IF NOT EXISTS slack_installations (
        id varchar(36) NOT NULL PRIMARY KEY,
        raw jsonb NOT NULL
      );`);
    }

    return true;
  }

  async storeInstallation<AuthVersion extends 'v1' | 'v2'>(
    installation: Installation<AuthVersion, boolean>,
  ): Promise<void> {
    if (
      installation.isEnterpriseInstall &&
      installation.enterprise !== undefined
    ) {
      await this.db('slack_enterprise_installations')
        .insert({
          id: installation.enterprise.id,
          raw: installation,
        })
        .onConflict('id')
        .merge(['raw']);
      this.metricsReporter.incrementCounter('stored_installations_total', 1, {
        enterprise: 'true',
      });
      return;
    }
    if (installation.team !== undefined) {
      await this.db('slack_installations')
        .insert({
          id: installation.team.id,
          raw: installation,
        })
        .onConflict('id')
        .merge(['raw']);
      this.metricsReporter.incrementCounter('stored_installations_total', 1, {
        enterprise: 'false',
      });

      await this.importManager.addTeamToImport(
        installation.team.id,
        installation.bot.token,
      );

      return;
    }
    throw new Error('Failed saving installation data to installationStore');
  }

  async fetchInstallation(
    query: InstallationQuery<boolean>,
  ): Promise<Installation<'v1' | 'v2', boolean>> {
    if (query.isEnterpriseInstall && query.enterpriseId !== undefined) {
      const res = await this.db
        .select('raw')
        .from('slack_enterprise_installations')
        .where({ id: query.enterpriseId });
      if (!res || res.length == 0) {
        throw new Error('no installation found');
      }

      this.metricsReporter.incrementCounter('fetched_installations_total', 1, {
        enterprise: 'true',
      });
      return res[0] as Installation<'v1' | 'v2', boolean>;
    }
    if (query.teamId !== undefined) {
      const res = await this.db
        .select('raw')
        .from('slack_installations')
        .where({ id: query.teamId });
      if (!res || res.length == 0) {
        throw new Error('no installation found');
      }

      this.metricsReporter.incrementCounter('fetched_installations_total', 1, {
        enterprise: 'false',
      });
      return res[0] as Installation<'v1' | 'v2', boolean>;
    }
    throw new Error('Failed fetching installation');
  }

  async deleteInstallation(query: InstallationQuery<boolean>): Promise<void> {
    if (query.isEnterpriseInstall && query.enterpriseId !== undefined) {
      await this.db('slack_enterprise_installations')
        .where({ id: query.enterpriseId })
        .delete();

      this.metricsReporter.incrementCounter('deleted_installations_total', 1, {
        enterprise: 'true',
      });
      return;
    }
    if (query.teamId !== undefined) {
      await this.db('slack_installations').where({ id: query.teamId }).delete();

      this.metricsReporter.incrementCounter('deleted_installations_total', 1, {
        enterprise: 'false',
      });
      return;
    }
    throw new Error('Failed to delete installation');
  }
}
