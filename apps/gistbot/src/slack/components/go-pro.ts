import { KnownBlock } from '@slack/web-api';
import { Routes } from '../../routes/router';

export const GoProText =
  'It looks like you have exceeded your daily summary limit. To get more summaries per day, please subscribe to our pro tier';

export const GoPro = (): KnownBlock[] => {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: GoProText,
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Go Pro',
          emoji: true,
        },
        url: 'https://thegist.ai/pricing',
        action_id: Routes.CLICKED_TO_OPEN_PRICING,
      },
    },
  ];
};
