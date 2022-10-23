import { IReporter } from '@base/metrics';
import { PgUtil, PgConfig } from '../utils/pg-util';

export interface OnboardingStore {
  userOnboarded(teamId: string, userId: string): Promise<void>;
  wasUserOnboarded(teamId: string, userId: string): Promise<boolean>;
}

export class PgOnboardingStore extends PgUtil implements OnboardingStore {
  constructor(private metricsReporter: IReporter, cfg: PgConfig) {
    super(cfg);
  }

  async synchronizeTables(): Promise<void> {
    await this.db.raw(`CREATE TABLE IF NOT EXISTS gistbot_user_onboardings (
      slack_team_id varchar(36) NOT NULL,
      slack_user_id varchar(36) NOT NULL,
      PRIMARY KEY ("slack_team_id", "slack_user_id")
    );`);
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
