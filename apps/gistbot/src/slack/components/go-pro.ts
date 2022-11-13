import { KnownBlock } from '@slack/web-api';
import { GoProButton } from './go-pro-button';

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
      accessory: GoProButton(),
    },
  ];
};
