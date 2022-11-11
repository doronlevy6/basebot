import { url, stripeApiKey, stripeWebhookSecret } from './sim-env';
import { simulateStripeWebhook } from './sim-hook';

const event = {
  id: 'evt_1M1zTSIIiJlhURo2mtfnVEdR',
  object: 'event',
  api_version: null,
  created: 1667943410,
  data: {
    object: {
      id: 'cus_Mm8PQkQBncel9Jaaa',
      object: 'customer',
      address: null,
      balance: 0,
      created: 1668095224,
      currency: 'usd',
      default_source: null,
      delinquent: false,
      description: null,
      discount: null,
      email: 'coby@base.la',
      invoice_prefix: '1D4FF38',
      invoice_settings: {
        custom_fields: null,
        default_payment_method: null,
        footer: null,
        rendering_options: null,
      },
      livemode: false,
      metadata: {},
      name: null,
      next_invoice_sequence: 1,
      phone: null,
      preferred_locales: [],
      shipping: null,
      tax_exempt: 'none',
      test_clock: null,
    },
  },
  livemode: false,
  pending_webhooks: 0,
  request: {
    id: null,
    idempotency_key: null,
  },
  type: 'customer.created',
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
