import { Stripe } from 'stripe';
import { CustomerStore } from './customer-store';
import { SubscriptionTier } from './tiers';

export class SubscriptionManager {
  private client: Stripe;

  constructor(
    private customerStore: CustomerStore,
    stripeApiKey: string,
    private readonly enterpriseProductId,
  ) {
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
    const [info, hasEnterpriseStatus] = await Promise.all([
      this.customerStore.getCustomerInfoByUser(slackTeamId, slackUserId),
      this.customerStore.getCustomerEnterpriseStatusByTeam(slackTeamId),
    ]);

    // If any team member has an enterprise subscription,
    // then we return an enterprise tier.
    // TODO: We need to have some sort of system in place to make sure we don't "double dip" (have both types within same team).
    if (hasEnterpriseStatus) {
      return SubscriptionTier.ENTERPRISE;
    }

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

      // TODO: Return the leeway eventually when we have time to investigate values from Stripe.
      // Right now we use the `current_period_end`, which unfortunately continues to update in Stripe
      // even when the subscription is no longer active. We need to find which value shows the end of the
      // last time they paid (probably somewhere in invoicing).
      // For now, we comment this out so that people don't get infinite time without paying.

      // Provide one day of leeway, just in case something happens and we haven't billed them
      // or we haven't gotten the invoice yet or we haven't updated from the source of truth yet.
      // info.subscriptionEndsAt.setDate(info.subscriptionEndsAt.getDate() + 1);
      // const now = new Date();
      // if (now.getTime() > info.subscriptionEndsAt.getTime()) {
      // The subscription has ended because now is greater than the subscription period end.
      // This means the user is now on the free tier.
      //   return SubscriptionTier.FREE;
      // }
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

    const subscriptionProductIds = subscription.items.data.map((item) => {
      let productId: string;
      if (typeof item.price.product === 'string') {
        productId = item.price.product;
      } else {
        productId = item.price.product.id;
      }
      return productId;
    });

    const tier = subscriptionProductIds.includes(this.enterpriseProductId)
      ? SubscriptionTier.ENTERPRISE
      : SubscriptionTier.PRO;

    await this.customerStore.setCustomerSubscription(
      customerId,
      tier,
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
