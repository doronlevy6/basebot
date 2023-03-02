import { KnownBlock } from '@slack/web-api';
import { STRIPE_URL } from '../../../slack/components/go-pro-button';
import { Routes } from '../../../routes/router';

export const OnboardingHeaderGoProBlocks = (
  timeLeft?: number,
): KnownBlock[] => {
  if (timeLeft === undefined) {
    return [];
  }
  let text = `You have ${timeLeft} days left on your free trial\n<${STRIPE_URL}|Extend free trial by a month>`;
  if (timeLeft < 0) {
    text = `You have exceeded your free trial\n<${STRIPE_URL}|Extend free trial by a month>`;
  }
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: text,
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Settings',
          emoji: true,
        },
        value: 'settings',
        action_id: Routes.OPEN_ALL_SETTINGS_MODAL,
      },
    },
  ];
};
