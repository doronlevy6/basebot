const env = process.argv[2] || 'local'; // get the env from the argument

// Before anything else runs, first we must load the environment that we are running
import { loadEnvs } from '../../libs/env/src';
loadEnvs(
  {
    serviceName: 'stripe_webhook_simulator',
    env: env,
    cwd: process.cwd(),
  },
  ['configs', 'secrets'],
);

let webhookUrl: string;
switch (env) {
  case 'staging':
    webhookUrl = 'https://treasury.baselabs.dev/stripe-webhook';
    break;
  case 'production':
    webhookUrl = 'https://treasury.thegist.ai/stripe-webhook';
    break;
  default:
    webhookUrl = 'http://localhost:3003/stripe-webhook';
    break;
}
export const url = webhookUrl;

export const stripeApiKey = process.env.STRIPE_API_KEY;
if (!stripeApiKey) {
  throw new Error('stripe api key is missing in secrets');
}

export const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!stripeWebhookSecret) {
  throw new Error('stripe webhook secret is missing in secrets');
}
