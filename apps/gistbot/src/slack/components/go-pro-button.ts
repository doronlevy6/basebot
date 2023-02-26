import { Button } from '@slack/web-api';
import { Routes } from '../../routes/router';
export const STRIPE_URL = 'https://buy.stripe.com/9AQ5kC2aR3mUaoU149';
export const GoProButton = (): Button => {
  return {
    type: 'button',
    style: 'primary',
    text: {
      type: 'plain_text',
      text: 'Try 1 month for FREE',
      emoji: true,
    },
    url: STRIPE_URL,
    action_id: Routes.CLICKED_TO_OPEN_PRICING,
  };
};
