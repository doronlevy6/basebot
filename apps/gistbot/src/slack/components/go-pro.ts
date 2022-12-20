import { KnownBlock } from '@slack/web-api';
import { GoProButton } from './go-pro-button';
import { PromoCodeText } from './promo-code-text';

export const GoProText = `You have exceeded your daily summaries limit. To get more summaries per day, become a pro member now with our early bird plan. ${PromoCodeText()}`;

export const GoPro = (): KnownBlock[] => {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: GoProText,
      },
      accessory: GoProButton(),
    },
  ];
};
