import { PgUtil, PgConfig } from '@base/utils';

export class PgTriggerLock extends PgUtil {
  constructor(cfg: PgConfig) {
    super(cfg);
  }

  async synchronizeTables(): Promise<void> {
    await this.db
      .raw(`CREATE TABLE IF NOT EXISTS gistbot_persistent_trigger_locks (
    slack_team_id varchar(36) NOT NULL,
    slack_user_id varchar(36) NOT NULL,
    trigger_context varchar(36) NOT NULL,
    PRIMARY KEY ("slack_team_id", "slack_user_id", "trigger_context")
  );`);
  }

  async lockUser(
    triggerContext: string,
    teamId: string,
    userId: string,
  ): Promise<void> {
    await this.db('gistbot_persistent_trigger_locks')
      .insert({
        slack_team_id: teamId,
        slack_user_id: userId,
        trigger_context: triggerContext,
      })
      .onConflict(['slack_team_id', 'slack_user_id', 'trigger_context'])
      .ignore();
  }

  async unlockUser(
    triggerContext: string,
    teamId: string,
    userId: string,
  ): Promise<void> {
    await this.db('gistbot_persistent_trigger_locks').delete().where({
      slack_team_id: teamId,
      slack_user_id: userId,
    });
  }

  async isUserLocked(
    triggerContext: string,
    teamId: string,
    userId: string,
  ): Promise<boolean> {
    const res = await this.db
      .select(1)
      .from('gistbot_persistent_trigger_locks')
      .where({
        slack_team_id: teamId,
        slack_user_id: userId,
      });
    if (!res || res.length == 0) {
      return false;
    }
    return true;
  }
}
