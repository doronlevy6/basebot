import { Stripe } from 'stripe';
import { CustomerStore } from './customer-store';
import { SubscriptionTier } from './tiers';

export class SubscriptionManager {
  private client: Stripe;

  constructor(private customerStore: CustomerStore, stripeApiKey: string) {
    this.client = new Stripe(stripeApiKey, {
      apiVersion: '2022-08-01',
      typescript: true,
      maxNetworkRetries: 10,
      timeout: 60 * 1000, // milliseconds
      telemetry: false,
    });
  }

  async userTier(
    slackTeamId: string,
    slackUserId: string,
  ): Promise<SubscriptionTier> {
    const info = await this.customerStore.getCustomerInfoByUser(
      slackTeamId,
      slackUserId,
    );
    if (!info) {
      return SubscriptionTier.FREE;
    }

    if (info.subscriptionActive) {
      if (!info.subscriptionEndsAt) {
        // Shouldn't happen... but types so ok...
        throw new Error(
          'subscription is active but there is no period attached to it!',
        );
      }

      // Provide one day of leeway, just in case something happens and we haven't billed them
      // or we haven't gotten the invoice yet or we haven't updated from the source of truth yet.
      info.subscriptionEndsAt.setDate(info.subscriptionEndsAt.getDate() + 1);
      const now = new Date();
      if (now.getTime() > info.subscriptionEndsAt.getTime()) {
        // The subscription has ended because now is greater than the subscription period end.
        // This means the user is now on the free tier.
        return SubscriptionTier.FREE;
      }
      return info.subscriptionTier || SubscriptionTier.FREE;
    }

    return SubscriptionTier.FREE;
  }

  async createSubscription(subscription: Stripe.Subscription) {
    // For now it's just going to use the same function, since it's all just doing the same thing.
    // If we implement stuff later for creation then we can add stuff here.
    return this.updateSubscription(subscription);
  }

  async updateSubscription(subscription: Stripe.Subscription) {
    const subscriptionActive =
      subscription.status === 'active' || subscription.status === 'trialing';

    let customerId: string;
    if (typeof subscription.customer === 'string') {
      customerId = subscription.customer;
    } else {
      customerId = subscription.customer.id;
    }

    await this.customerStore.setCustomerSubscription(
      customerId,
      // TODO: Match different levels of subscriptions?
      // Right now we only have the one (other than enterprise which is separate)
      SubscriptionTier.PRO,
      subscriptionActive,
      subscription.current_period_end,
    );

    return;
  }

  async payInvoice(invoice: Stripe.Invoice) {
    if (!invoice.subscription) {
      throw new Error('no subscription on invoice');
    }
    let subscriptionId: string;
    let subscription: Stripe.Subscription | undefined;
    if (typeof invoice.subscription === 'string') {
      subscriptionId = invoice.subscription;
    } else {
      subscriptionId = invoice.subscription.id;
      subscription = invoice.subscription;
    }

    if (!subscription) {
      subscription = await this.client.subscriptions.retrieve(subscriptionId);
    }

    // For now it's just going to use the same function, since it's all just doing the same thing.
    // If we implement stuff later for deletion then we can add stuff here
    return this.updateSubscription(subscription);
  }

  async deactivateSubscription(subscription: Stripe.Subscription) {
    // For now it's just going to use the same function, since it's all just doing the same thing.
    // If we implement stuff later for deletion then we can add stuff here
    return this.updateSubscription(subscription);
  }
}
