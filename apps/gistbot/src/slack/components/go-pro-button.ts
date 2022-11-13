import { Button } from '@slack/web-api';
import { Routes } from '../../routes/router';

export const GoProButton = (): Button => {
  return {
    type: 'button',
    text: {
      type: 'plain_text',
      text: 'Go Pro',
      emoji: true,
    },
    url: 'https://thegist.ai/pricing',
    action_id: Routes.CLICKED_TO_OPEN_PRICING,
  };
};
