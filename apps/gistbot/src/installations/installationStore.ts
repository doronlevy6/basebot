import { IReporter } from '@base/metrics';
import {
  Installation,
  InstallationQuery,
  InstallationStore,
} from '@slack/bolt';
import { PgUtil, PgConfig } from '../utils/pg-util';

export class PgInstallationStore extends PgUtil implements InstallationStore {
  private metricsReporter: IReporter;

  constructor(metricsReporter: IReporter, cfg: PgConfig) {
    super(cfg);
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
  }

  async synchronizeTables(): Promise<void> {
    await this.db
      .raw(`CREATE TABLE IF NOT EXISTS gistbot_slack_enterprise_installations (
    slack_id varchar(36) NOT NULL PRIMARY KEY,
    raw jsonb NOT NULL
  );`);

    await this.db.raw(`CREATE TABLE IF NOT EXISTS gistbot_slack_installations (
    slack_id varchar(36) NOT NULL PRIMARY KEY,
    raw jsonb NOT NULL
  );`);
  }

  async storeInstallation<AuthVersion extends 'v1' | 'v2'>(
    installation: Installation<AuthVersion, boolean>,
  ): Promise<void> {
    if (
      installation.isEnterpriseInstall &&
      installation.enterprise !== undefined
    ) {
      await this.db('gistbot_slack_enterprise_installations')
        .insert({
          slack_id: installation.enterprise.id,
          raw: installation,
        })
        .onConflict('slack_id')
        .merge(['raw']);
      this.metricsReporter.incrementCounter('stored_installations_total', 1, {
        enterprise: 'true',
      });
    }
    if (installation.team !== undefined) {
      await this.db('gistbot_slack_installations')
        .insert({
          slack_id: installation.team.id,
          raw: installation,
        })
        .onConflict('slack_id')
        .merge(['raw']);
      this.metricsReporter.incrementCounter('stored_installations_total', 1, {
        enterprise: 'false',
      });
    }
  }

  async fetchInstallation(
    query: InstallationQuery<boolean>,
  ): Promise<Installation<'v1' | 'v2', boolean>> {
    if (query.isEnterpriseInstall && query.enterpriseId !== undefined) {
      const res = await this.db
        .select('raw')
        .from('gistbot_slack_enterprise_installations')
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
        .from('gistbot_slack_installations')
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

  async fetchInstallationByTeamId(
    teamId: string,
  ): Promise<Installation<'v1' | 'v2', boolean>> {
    let enterprise = 'true';
    let res = await this.db
      .select('raw')
      .from('gistbot_slack_enterprise_installations')
      .where({ slack_id: teamId });
    if (!res || res.length == 0) {
      res = await this.db
        .select('raw')
        .from('gistbot_slack_installations')
        .where({ slack_id: teamId });
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
      await this.db('gistbot_slack_enterprise_installations')
        .where({ slack_id: query.enterpriseId })
        .delete();

      this.metricsReporter.incrementCounter('deleted_installations_total', 1, {
        enterprise: 'true',
      });
      return;
    }
    if (query.teamId !== undefined) {
      await this.db('gistbot_slack_installations')
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
