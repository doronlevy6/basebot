// Before anything else runs, first we must load the environment that we are running
import { loadEnvs } from '../libs/env/src';
loadEnvs(
  {
    serviceName: 'stripe_webhook_simulator',
    env: process.argv[2] || 'local', // get the env from the argument
    cwd: process.cwd(),
  },
  ['configs', 'secrets'],
);

const stripeApiKey = process.env.STRIPE_API_KEY;
if (!stripeApiKey) {
  throw new Error('stripe api key is missing in secrets');
}

const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!stripeWebhookSecret) {
  throw new Error('stripe webhook secret is missing in secrets');
}

const webhookUrl = 'http://localhost:3003/stripe-webhook';

import axios from 'axios';
import { Stripe } from 'stripe';
import { logger } from '../libs/logger/src';

async function main(
  key: string,
  secret: string,
  body: Record<string, any>,
): Promise<void> {
  const client = new Stripe(key, {
    apiVersion: '2022-08-01',
    typescript: true,
    maxNetworkRetries: 10,
    timeout: 60 * 1000, // milliseconds
    telemetry: false,
  });

  const header = client.webhooks.generateTestHeaderString({
    payload: JSON.stringify(body),
    secret: secret,
  });

  const res = await axios.post(webhookUrl, body, {
    headers: {
      'stripe-signature': header,
    },
    timeout: 1000 * (60 * 10),
  });

  if (res.status >= 300) {
    throw new Error('Invalid status code response');
  }

  logger.debug({ response: res.data });
}

const event = {
  id: 'evt_1M1zTSIIiJlhURo2mtfnVEdR',
  object: 'event',
  api_version: null,
  created: 1667943410,
  data: {
    object: {
      id: 'sub_1M2GHW2eZvKYlo2C2ed0bwwA',
      object: 'subscription',
      application: null,
      application_fee_percent: null,
      automatic_tax: {
        enabled: false,
      },
      billing_cycle_anchor: 1668008018,
      billing_thresholds: null,
      cancel_at: null,
      cancel_at_period_end: false,
      canceled_at: null,
      collection_method: 'charge_automatically',
      created: 1668008018,
      currency: 'usd',
      current_period_end: 1670600018,
      current_period_start: 1668008018,
      customer: 'cus_9BoKyB2Km2T7TE',
      days_until_due: null,
      default_payment_method: null,
      default_source: null,
      default_tax_rates: [],
      description: null,
      discount: null,
      ended_at: null,
      items: {
        object: 'list',
        data: [
          {
            id: 'si_Mlnte3kYfwtz13',
            object: 'subscription_item',
            billing_thresholds: null,
            created: 1668008018,
            metadata: {},
            price: {
              id: 'price_1M23ot2eZvKYlo2CzT1LD470',
              object: 'price',
              active: true,
              billing_scheme: 'per_unit',
              created: 1667960115,
              currency: 'usd',
              custom_unit_amount: null,
              livemode: false,
              lookup_key: null,
              metadata: {},
              nickname: null,
              product: 'prod_Mlb0cNGonAX7UM',
              recurring: {
                aggregate_usage: null,
                interval: 'month',
                interval_count: 1,
                usage_type: 'licensed',
              },
              tax_behavior: 'unspecified',
              tiers_mode: null,
              transform_quantity: null,
              type: 'recurring',
              unit_amount: 1200,
              unit_amount_decimal: '1200',
            },
            quantity: 1,
            subscription: 'sub_1M2GHW2eZvKYlo2C2ed0bwwA',
            tax_rates: [],
          },
        ],
        has_more: false,
        url: '/v1/subscription_items?subscription=sub_1M2GHW2eZvKYlo2C2ed0bwwA',
      },
      latest_invoice: null,
      livemode: false,
      metadata: {},
      next_pending_invoice_item_invoice: null,
      on_behalf_of: null,
      pause_collection: null,
      payment_settings: {
        payment_method_options: null,
        payment_method_types: null,
        save_default_payment_method: null,
      },
      pending_invoice_item_interval: null,
      pending_setup_intent: null,
      pending_update: null,
      schedule: null,
      start_date: 1668008018,
      status: 'active',
      test_clock: null,
      transfer_data: null,
      trial_end: null,
      trial_start: null,
    },
  },
  livemode: false,
  pending_webhooks: 0,
  request: {
    id: null,
    idempotency_key: null,
  },
  type: 'customer.subscription.updated',
};

main(stripeApiKey as string, stripeWebhookSecret as string, event)
  .then((_data) => {
    console.log('completed');
  })
  .catch((err) => {
    console.error('failed', err);
  });
