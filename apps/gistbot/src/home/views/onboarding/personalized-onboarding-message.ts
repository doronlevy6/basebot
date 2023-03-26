import { KnownBlock } from '@slack/web-api';
import { Routes } from '../../../routes/router';
import { UserLink } from '../../../slack/components/user-link';

export const GmailPersonalizedOnBoarding = (
  slackUserId: string,
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
        text: `Hi ${UserLink(slackUserId)}!`,
      },
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
