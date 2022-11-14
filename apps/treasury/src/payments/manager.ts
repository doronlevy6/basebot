import { logger } from '@base/logger';
import { IncomingHttpHeaders } from 'http';
import { Stripe } from 'stripe';
import { Publisher } from '../pubsub/types';
import { FullSyncJobLock } from './joblock';
import * as cron from 'node-cron';
import {
  CustomerIdentifier,
  SubscriptionManager,
} from '@base/customer-identifier';

export class PaymentsManager {
  private client: Stripe;
  private webhookSecret: string;
  private queue: string;
  private publisher: Publisher;
  private joblock: FullSyncJobLock;
  private customerIdentifier: CustomerIdentifier;
  private subscriptionManager: SubscriptionManager;

  constructor({
    stripeApiKey,
    stripeWebhookSecret,
    stripeEventsQueue,
    publisher,
    lock,
    customerIdentifier,
    subscriptionManager,
  }: {
    stripeApiKey: string;
    stripeWebhookSecret: string;
    stripeEventsQueue: string;
    publisher: Publisher;
    lock: FullSyncJobLock;
    customerIdentifier: CustomerIdentifier;
    subscriptionManager: SubscriptionManager;
  }) {
    this.client = new Stripe(stripeApiKey, {
      apiVersion: '2022-08-01',
      typescript: true,
      maxNetworkRetries: 10,
      timeout: 60 * 1000, // milliseconds
      telemetry: false,
    });
    this.webhookSecret = stripeWebhookSecret;
    this.queue = stripeEventsQueue;
    this.publisher = publisher;
    this.joblock = lock;
    this.customerIdentifier = customerIdentifier;
    this.subscriptionManager = subscriptionManager;
  }

  startFullSyncJob() {
    // Every Hour Crontab: https://crontab.guru/every-1-hour
    // Internally the cron should handle promises, this is an incorrect signature.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    cron.schedule(`0 * * * *`, async () => {
      await this.fullSync(100);
    });
  }

  // This is only public in order to allow triggering a full sync via an HTTP request for testing purposes.
  // This should not be used outside of the internal request handler publicly.
  async fullSync(pageLimit: number) {
    try {
      logger.debug(`running fullsync job`);
      const acquiredJob = await this.joblock.lock();
      if (!acquiredJob) {
        logger.debug(`full sync job is already running elsewhere, skipping`);
        return;
      }

      await this.joblock.extend(10);

      let awaits: Promise<void>[] = [];
      for await (const subscription of this.client.subscriptions.list({
        status: 'all',
      })) {
        await this.joblock.extend(10);
        awaits.push(this.syncSubscriptionFromApi(subscription));

        if (awaits.length >= pageLimit) {
          await Promise.all(awaits);
          awaits = []; // Reset to an empty array now that we've completed awaiting the chunk
        }
      }

      // Final await to ensure we await on any leftovers
      if (awaits.length > 0) {
        await Promise.all(awaits);
      }
    } catch (error) {
      logger.error({
        msg: `error in fullsync job`,
        error: error.message,
        stack: error.stack,
      });
    } finally {
      await this.joblock.release();
    }
  }

  private async syncSubscriptionFromApi(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    // Any canceled subscriptions should ensure that they are canceled in our DB,
    // and any active subscriptions should ensure that they are active in our DB.
    // Stripe's API is the source of truth, so we pull the data from there and ensure the DB is up to date.
    logger.debug({
      msg: `syncing subscription from api`,
      subscription: subscription,
    });
    await this.subscriptionManager.updateSubscription(subscription);
    logger.debug({
      msg: `synced subscription from api`,
      subscription: subscription,
    });
  }

  async verifyAndParseRequest(
    reqBody: string | Buffer,
    headers: IncomingHttpHeaders,
  ): Promise<Stripe.Event | undefined> {
    try {
      const signature = headers['stripe-signature'];
      if (!signature) {
        throw new Error('no signature in stripe request');
      }

      const event = await this.client.webhooks.constructEventAsync(
        reqBody,
        signature,
        this.webhookSecret,
      );

      return event;
    } catch (error) {
      logger.error({
        msg: `error in request verification and parsing`,
        error: error.message,
        stack: error.stack,
      });
    }
  }

  async publish(event: Stripe.Event) {
    // Stripe's Typescript types export Stripe.Event as both an interface and a namespace.
    // That means that even though a Stripe.Event interface is just an interface to an object,
    // Typescript's type system decided that it's both an object and a namespace, because somehow that's allowed.
    // So basically, fuck types. This language should not exist.
    // Here's a terrible hack that does something that converts it to an object, I guess... it straight up breaks type safety,
    // but that's what you get when you use a language that was literally built in 10 days.
    const forcedType = event as unknown as Record<string, unknown>;
    await this.publisher.publish(this.queue, forcedType);
  }

  async consume(raw: Record<string, unknown>): Promise<boolean> {
    try {
      logger.debug({ msg: `consuming payment event`, raw: raw });

      // See the above publish method for why this is happening like this and why this language is a dumpster fire.
      const event = raw as unknown as Stripe.Event;
      logger.debug({ msg: `payment event`, event: event });

      switch (event.type) {
        case 'customer.created':
          await this.handleCustomerCreated(
            event.data.object as Stripe.Customer,
          );
          break;
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(
            event.data.object as Stripe.Subscription,
          );
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription,
          );
          break;
        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription,
          );
          break;
        default:
          logger.info({
            msg: 'unknown event type',
            type: event.type,
            data: event.data.object,
          });
      }

      return true;
    } catch (error) {
      logger.error({
        msg: `error in consuming payment event`,
        error: error.message,
        stack: error.stack,
      });
      return false;
    }
  }

  private async handleCustomerCreated(event: Stripe.Customer) {
    // The event will fire when a customer is officially created in the system.
    // This should kick off our customer matching and verification, so that we
    // can match the customer to the relevant Slack Team and User ID.
    await this.customerIdentifier.identifyCustomer(event);
    logger.info({ msg: 'customer created', data: event });
  }

  private async handleSubscriptionCreated(event: Stripe.Subscription) {
    // The event will fire when a customer creates a subscription, but it does not
    // necessarily mean that the customer has completed payment on the subscription.
    // Check status to see if the subscription is active. If it is not active,
    // this means that the customer has not paid yet, or that payment is incomplete.
    await this.subscriptionManager.createSubscription(event);
    logger.info({ msg: 'subscription created', data: event });
  }

  private async handleSubscriptionUpdated(event: Stripe.Subscription) {
    // The event will fire when the subscription is changed, generally when the status updates.
    // When the status updates, we should check to see if it is active. If it is, we can enable
    // the user's subscription in the database.
    await this.subscriptionManager.updateSubscription(event);
    logger.info({ msg: 'subscription updated', data: event });
  }

  private async handleInvoicePaid(event: Stripe.Invoice) {
    // The event will fire when the invoice is officially paid for the subscription.
    // When we receive this we should validate that the subscription status is active in Stripe,
    // and then ensure that the user's subscription is active in our database.
    await this.subscriptionManager.payInvoice(event);
    logger.info({ msg: 'invoice paid', data: event });
  }

  private async handleSubscriptionDeleted(event: Stripe.Subscription) {
    // The event will fire when the subscription is deleted and the user's subscription ends.
    // This should delete the user's subscription in the database.
    await this.subscriptionManager.deactivateSubscription(event);
    logger.info({ msg: 'subscription deleted', data: event });
  }
}
