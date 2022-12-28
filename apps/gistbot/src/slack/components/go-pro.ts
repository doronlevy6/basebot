import { KnownBlock } from '@slack/web-api';
import { GoProButton } from './go-pro-button';
import { PromoCodeText } from './promo-code-text';

export const GoProText = `You have exceeded your daily chat sessions limit. To get unlimited chat sessions and more features, become a pro member now with our early bird plan. ${PromoCodeText()}`;
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
