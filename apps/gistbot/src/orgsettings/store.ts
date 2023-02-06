import { PgUtil, PgConfig } from '@base/utils';

type RawJson = Record<string, unknown>;

export interface OrgSettings extends RawJson {
  newUserTriggersEnabled: boolean;
}

const defaultSettings: OrgSettings = {
  newUserTriggersEnabled: true,
};

export interface OrgSettingsStore {
  getSettings(slackTeamId: string): Promise<OrgSettings>;
}

export class PgOrgSettingsStore extends PgUtil implements OrgSettingsStore {
  constructor(cfg: PgConfig) {
    super(cfg);
  }

  async synchronizeTables(): Promise<void> {
    await this.db.raw(`CREATE TABLE IF NOT EXISTS gistbot_org_settings (
    slack_team_id varchar(36) NOT NULL PRIMARY KEY,
    settings jsonb NOT NULL
  );`);
  }

  async getSettings(slackTeamId: string): Promise<OrgSettings> {
    const res = await this.db
      .select('settings')
      .from('gistbot_org_settings')
      .where({ slack_team_id: slackTeamId });
    if (!res || res.length == 0) {
      return { ...defaultSettings };
    }

    return res[0].settings as OrgSettings;
  }
}
