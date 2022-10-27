import { logger } from '@base/logger';
import { PgUtil, PgConfig } from '../utils/pg-util';
import { SubscriptionTier, SubscriptionTierFromString } from './limits';

export interface TiersStore {
  userTier(teamId: string, userId: string): Promise<SubscriptionTier>;
}

export class PgTiersStore extends PgUtil implements TiersStore {
  constructor(cfg: PgConfig) {
    super(cfg);
  }

  async synchronizeTables(): Promise<void> {
    await this.db
      .raw(`CREATE TABLE IF NOT EXISTS gistbot_user_subscription_tiers (
      slack_team_id varchar(36) NOT NULL,
      slack_user_id varchar(36) NOT NULL,
      subscription_tier varchar(36) NOT NULL,
      PRIMARY KEY ("slack_team_id", "slack_user_id")
    );`);
  }

  async userTier(teamId: string, userId: string): Promise<SubscriptionTier> {
    const res = await this.db
      .select('subscription_tier')
      .from('gistbot_user_subscription_tiers')
      .where({ slack_team_id: teamId, slack_user_id: userId });
    if (!res || res.length == 0) {
      return SubscriptionTier.FREE;
    }

    const storedTier = res[0].subscription_tier;
    const tier = SubscriptionTierFromString(storedTier);
    if (!tier) {
      logger.error({ msg: `unknown subscription tier`, tier: storedTier });
      return SubscriptionTier.FREE; // Default to return free tier so that it doesn't crash accidentally
    }

    return tier;
  }
}
