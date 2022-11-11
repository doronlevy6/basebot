import axios from 'axios';
import { Stripe } from 'stripe';
import { logger } from '../../libs/logger/src';

export async function simulateStripeWebhook(
  url: string,
  key: string,
  secret: string,
  body: Record<string, any>,
): Promise<void> {
  logger.debug({
    msg: 'simulating stripe webhook',
    url: url,
    key: key,
    secret: secret,
    body: body,
  });

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

  const res = await axios.post(url, body, {
    headers: {
      'stripe-signature': header,
      'User-Agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)',
    },
    timeout: 1000 * (60 * 10),
  });

  if (res.status >= 300) {
    throw new Error('Invalid status code response');
  }

  logger.debug({ response: res.data });
}
