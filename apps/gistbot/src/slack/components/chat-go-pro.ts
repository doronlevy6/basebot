import { KnownBlock } from '@slack/web-api';
import { GoProButton } from './go-pro-button';
import { PromoCodeText } from './promo-code-text';

export const ChatGoProText = `I’ve got too much going on and I’m limited to helping with only 2 sessions a day for free users. Start a free 1 month trial of our Pro plan and I’ll be able to help you as much as you want :hugging_face: ${PromoCodeText()}`;

export const ChatGoPro = (): KnownBlock[] => {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ChatGoProText,
      },
      accessory: GoProButton(),
    },
    {
      type: 'image',
      title: {
        type: 'plain_text',
        text: 'go pro',
        emoji: true,
      },
      image_url: 'https://media.giphy.com/media/z9fOrELqdSnFm/giphy.gif',
      alt_text: 'go pro',
    },
  ];
};
