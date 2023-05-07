import { logger } from '@base/logger';
import { PgUtil, PgConfig } from '@base/utils';
import { SubscriptionTier, SubscriptionTierFromString } from './tiers';

interface CustomerInfo {
  customerId: string;
  passphrase: string;
  subscriptionActive: boolean;
  subscriptionTier?: SubscriptionTier;
  subscriptionEndsAt?: Date;
  slackTeamId?: string;
  slackUserId?: string;
}

export interface CustomerStore {
  addCustomer(customerId: string, passphrase: string): Promise<boolean>;
  getCustomerInfo(customerId: string): Promise<CustomerInfo | undefined>;
  getCustomerInfoByUser(
    slackTeamId: string,
    slackUserId: string,
  ): Promise<CustomerInfo | undefined>;
  getCustomerEnterpriseStatusByTeam(slackTeamId: string): Promise<boolean>;
  setCustomerInfo(
    customerId: string,
    slackTeamId: string,
    slackUserId: string,
  ): Promise<void>;
  getCustomerByPassphrase(
    passphrase: string,
  ): Promise<CustomerInfo | undefined>;
  setCustomerSubscription(
    customerId: string,
    subscriptionTier: SubscriptionTier,
    subscriptionActive: boolean,
    subscriptionEndsAt: number,
  ): Promise<void>;
}

export class PgCustomerStore extends PgUtil implements CustomerStore {
  constructor(cfg: PgConfig) {
    super(cfg);
  }

  async synchronizeTables(): Promise<void> {
    await this.db.raw(`CREATE TABLE IF NOT EXISTS treasury_customers (
      customer_id varchar(36) NOT NULL PRIMARY KEY,
      slack_team_id varchar(36),
      slack_user_id varchar(36),
      subscription_tier varchar(36),
      subscription_active boolean NOT NULL DEFAULT FALSE,
      subscription_ends_at bigint,
      passphrase varchar(255) CONSTRAINT treasury_customers_passphrase_key UNIQUE,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS treasury_customers_slack_ids ON treasury_customers (slack_team_id, slack_user_id);`);
  }

  async addCustomer(customerId: string, passphrase: string): Promise<boolean> {
    try {
      // We can't use the query builder here because our query is just a bit too complicated for it.
      // The tricky part that can't be expressed in the builder is the COALESCE clause, which simply
      // ensures that we only update the passphrase if the current value in the table is NULL.
      // This will allow us to insert a customer_id from various places (some of which might not generate a passphrase),
      // while keeping the passphrase the same once it is set the first time someone sets it.
      await this.db.raw(
        `INSERT INTO treasury_customers (customer_id, passphrase)
        VALUES (:customer_id, :passphrase)
        ON CONFLICT(customer_id) DO UPDATE
        SET
          passphrase = COALESCE(treasury_customers.passphrase, excluded.passphrase),
          updated_at = CURRENT_TIMESTAMP;`,
        {
          customer_id: customerId,
          passphrase: passphrase,
        },
      );
      return true;
    } catch (error) {
      if (
        (error as Error).message.includes(
          'duplicate key value violates unique constraint',
        ) &&
        (error as Error).message.includes('treasury_customers_passphrase_key')
      ) {
        return false;
      }
      throw error;
    }
  }

  async setCustomerSubscription(
    customerId: string,
    subscriptionTier: SubscriptionTier,
    subscriptionActive: boolean,
    subscriptionEndsAt: number,
  ): Promise<void> {
    await this.db('treasury_customers')
      .insert({
        customer_id: customerId,
        subscription_tier: subscriptionTier,
        subscription_active: subscriptionActive,
        subscription_ends_at: subscriptionEndsAt,
      })
      .onConflict('customer_id')
      .merge({
        subscription_tier: subscriptionTier,
        subscription_active: subscriptionActive,
        subscription_ends_at: subscriptionEndsAt,
        updated_at: new Date().toUTCString(),
      });
  }

  async setCustomerInfo(
    customerId: string,
    slackTeamId: string,
    slackUserId: string,
  ): Promise<void> {
    await this.db('treasury_customers')
      .update({
        slack_team_id: slackTeamId,
        slack_user_id: slackUserId,
        updated_at: new Date().toUTCString(),
      })
      .where({
        customer_id: customerId,
      });
  }

  async getCustomerByPassphrase(
    passphrase: string,
  ): Promise<CustomerInfo | undefined> {
    const res = await this.db.select('*').from('treasury_customers').where({
      passphrase: passphrase,
    });
    if (!res || res.length == 0) {
      return;
    }

    const storedTier = res[0]['subscription_tier'] || 'free';
    let tier = SubscriptionTierFromString(storedTier);
    if (!tier) {
      logger.error({ msg: `unknown subscription tier`, tier: storedTier });
      tier = SubscriptionTier.FREE; // Default to return free tier so that it doesn't crash accidentally
    }

    return {
      customerId: res[0]['customer_id'],
      passphrase: res[0]['passphrase'],
      subscriptionTier: tier,
      subscriptionActive: res[0]['subscription_active'],
      subscriptionEndsAt: res[0]['subscription_ends_at']
        ? new Date(res[0]['subscription_ends_at'] * 1000) // Multiply by 1000 because JS dates are milliseconds and normal dates are seconds
        : undefined,
      slackTeamId: res[0]['slack_team_id'],
      slackUserId: res[0]['slack_user_id'],
    };
  }

  async getCustomerInfo(customerId: string): Promise<CustomerInfo | undefined> {
    const res = await this.db.select('*').from('treasury_customers').where({
      customer_id: customerId,
    });
    if (!res || res.length == 0) {
      return;
    }

    const storedTier = res[0]['subscription_tier'] || 'free';
    let tier = SubscriptionTierFromString(storedTier);
    if (!tier) {
      logger.error({ msg: `unknown subscription tier`, tier: storedTier });
      tier = SubscriptionTier.FREE; // Default to return free tier so that it doesn't crash accidentally
    }

    return {
      customerId: res[0]['customer_id'],
      passphrase: res[0]['passphrase'],
      subscriptionTier: tier,
      subscriptionActive: res[0]['subscription_active'],
      subscriptionEndsAt: res[0]['subscription_ends_at']
        ? new Date(res[0]['subscription_ends_at'] * 1000) // Multiply by 1000 because JS dates are milliseconds and normal dates are seconds
        : undefined,
      slackTeamId: res[0]['slack_team_id'],
      slackUserId: res[0]['slack_user_id'],
    };
  }

  async getCustomerInfoByUser(
    slackTeamId: string,
    slackUserId: string,
  ): Promise<CustomerInfo | undefined> {
    const res = await this.db.select('*').from('treasury_customers').where({
      slack_team_id: slackTeamId,
      slack_user_id: slackUserId,
    });
    if (!res || res.length == 0) {
      return;
    }

    const storedTier = res[0]['subscription_tier'] || 'free';
    let tier = SubscriptionTierFromString(storedTier);
    if (!tier) {
      logger.error({ msg: `unknown subscription tier`, tier: storedTier });
      tier = SubscriptionTier.FREE; // Default to return free tier so that it doesn't crash accidentally
    }

    return {
      customerId: res[0]['customer_id'],
      passphrase: res[0]['passphrase'],
      subscriptionTier: tier,
      subscriptionActive: res[0]['subscription_active'],
      subscriptionEndsAt: res[0]['subscription_ends_at']
        ? new Date(res[0]['subscription_ends_at'] * 1000) // Multiply by 1000 because JS dates are milliseconds and normal dates are seconds
        : undefined,
      slackTeamId: res[0]['slack_team_id'],
      slackUserId: res[0]['slack_user_id'],
    };
  }

  async getCustomerEnterpriseStatusByTeam(
    slackTeamId: string,
  ): Promise<boolean> {
    // Force select 1. If rows returned is 0 then the WHERE clause didn't match,
    // so no rows is equivalent to no enterprise. If rows are returned, then
    // the WHERE clause matched, so any rows is equivalent to enterprise.
    const res = await this.db.select('1').from('treasury_customers').where({
      slack_team_id: slackTeamId,
      subscription_tier: SubscriptionTier.ENTERPRISE,
    });
    if (!res || res.length == 0) {
      return false;
    }
    return true;
  }
}
