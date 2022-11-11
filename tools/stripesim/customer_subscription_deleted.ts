import { url, stripeApiKey, stripeWebhookSecret } from './sim-env';
import { simulateStripeWebhook } from './sim-hook';

const event = {
  id: 'evt_1M1zTSIIiJlhURo2mtfnVEdR',
  object: 'event',
  api_version: null,
  created: 1667943410,
  data: {
    object: {
      id: 'sub_1M2hmW2eZvKYlo2CQpBzF556',
      object: 'subscription',
      application: null,
      application_fee_percent: null,
      automatic_tax: {
        enabled: false,
      },
      billing_cycle_anchor: 1668113728,
      billing_thresholds: null,
      cancel_at: null,
      cancel_at_period_end: false,
      canceled_at: null,
      collection_method: 'charge_automatically',
      created: 1668113728,
      currency: 'usd',
      current_period_end: 1670705728,
      current_period_start: 1668113728,
      customer: 'cus_Mm8PQkQBncel9Jaaa',
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
            id: 'si_MmGJvp7yCxMWpW',
            object: 'subscription_item',
            billing_thresholds: null,
            created: 1668113728,
            metadata: {},
            price: {
              id: 'price_1M2GPd2eZvKYlo2CDKi6TmT5',
              object: 'price',
              active: true,
              billing_scheme: 'per_unit',
              created: 1668008521,
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
            subscription: 'sub_1M2hmW2eZvKYlo2CQpBzF556',
            tax_rates: [],
          },
        ],
        has_more: false,
        url: '/v1/subscription_items?subscription=sub_1M2hmW2eZvKYlo2CQpBzF556',
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
      start_date: 1668113728,
      status: 'canceled',
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
  type: 'customer.subscription.deleted',
};

simulateStripeWebhook(
  url,
  stripeApiKey as string,
  stripeWebhookSecret as string,
  event,
)
  .then((_data) => {
    console.log('completed');
  })
  .catch((err) => {
    console.error('failed', err);
  });
