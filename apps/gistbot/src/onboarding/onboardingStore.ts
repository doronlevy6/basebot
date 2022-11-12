import { IReporter } from '@base/metrics';
import { PgUtil, PgConfig } from '@base/utils';
import { OnBoardedUser } from './types';

export interface OnboardingStore {
  userOnboarded(
    teamId: string,
    userId: string,
    completedAt?: Date,
    attempts?: number,
  ): Promise<void>;
  wasUserOnboarded(
    teamId: string,
    userId: string,
  ): Promise<OnBoardedUser | undefined>;
  getUsersNotCompletedOnboarding(
    attemps: number,
    limit?: number,
    offset?: number,
  ): Promise<OnBoardedUser[]>;
}

export class PgOnboardingStore extends PgUtil implements OnboardingStore {
  constructor(private metricsReporter: IReporter, cfg: PgConfig) {
    super(cfg);
    this.metricsReporter.registerCounter(
      'onboarded_users_total',
      'A counter for the number of onboarded users',
      [],
    );
  }

  async synchronizeTables(): Promise<void> {
    await this.db.raw(`CREATE TABLE IF NOT EXISTS gistbot_user_onboardings (
      slack_team_id varchar(36) NOT NULL,
      slack_user_id varchar(36) NOT NULL,
      PRIMARY KEY ("slack_team_id", "slack_user_id")
    );

    Alter table gistbot_user_onboardings
    Add column IF NOT EXISTS updated_at timestamp not null default current_timestamp,
    Add column IF NOT EXISTS completed_at timestamp,
    Add column IF NOT EXISTS attempts integer default 0;

    update gistbot_user_onboardings set completed_at = current_timestamp
    where updated_at < current_timestamp + interval '1' hour;
    `);
  }

  async userOnboarded(
    teamId: string,
    userId: string,
    completedAt?: Date,
    attempts?: number,
  ): Promise<void> {
    const updatedAt = new Date().toUTCString();
    await this.db('gistbot_user_onboardings')
      .insert({
        slack_team_id: teamId,
        slack_user_id: userId,
        updated_at: updatedAt,
        completed_at: completedAt?.toUTCString(),
        attempts,
      })
      .onConflict(['slack_team_id', 'slack_user_id'])
      .merge();
    this.metricsReporter.incrementCounter('onboarded_users_total', 1, {});
  }

  async wasUserOnboarded(
    teamId: string,
    userId: string,
  ): Promise<OnBoardedUser | undefined> {
    const res = await this.db
      .select('*')
      .from('gistbot_user_onboardings')
      .where({ slack_team_id: teamId, slack_user_id: userId });
    if (!res || res.length == 0) {
      return undefined;
    }

    const user = new OnBoardedUser();
    user.slackTeam = res[0]['slack_team_id'];
    user.slackUser = res[0]['slack_user_id'];
    user.completedAt = res[0]['completed_at']
      ? new Date(res[0]['completed_at'])
      : undefined;
    user.updatedAt = new Date(res[0]['updated_at']);
    user.attempts = res[0]['attempts'];
    return user;
  }

  async getUsersNotCompletedOnboarding(
    attemps: number,
    limit?: number,
    offset?: number,
  ): Promise<OnBoardedUser[]> {
    const res = await this.db
      .select('*')
      .from('gistbot_user_onboardings')
      .whereNull('completed_at')
      .andWhere('attempts', '<', attemps)
      .limit(limit || 100)
      .offset(offset || 0);

    if (!res || res.length == 0) {
      return [];
    }

    const resUsers: OnBoardedUser[] = res.map((val) => {
      const user = new OnBoardedUser();
      user.slackTeam = val['slack_team_id'];
      user.slackUser = val['slack_user_id'];
      user.updatedAt = new Date(val['updated_at']);
      user.attempts = val['attempts'];
      return user;
    });

    return resUsers;
  }
}
