import { KnownBlock } from '@slack/web-api';
import { Routes } from '../../../routes/router';

export const GmailPersonalizedOnBoarding = (
  onBoardingMessage?: string,
): KnownBlock[] => {
  if (!onBoardingMessage) {
    return [];
  }
  return [
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: onBoardingMessage,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Dismiss',
            emoji: true,
          },
          value: 'click_me_123',
          action_id: Routes.MAIL_ONBOARDING_DISMISSED,
        },
      ],
    },
  ];
};
