import { KnownBlock } from '@slack/web-api';
import { Routes } from '../../../routes/router';
import { SlackDate } from '../../../slack/components/date';
import { OnboardingHeaderGoProBlocks } from '../onboarding/onboarding-header-go-pro';

export const EmailHeaderBlocks = (
  email: string,
  lastUpdated: number,
): KnownBlock[] => [
  {
    type: 'header',
    text: {
      type: 'plain_text',
      text: email,
      emoji: true,
    },
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: 'Updated ' + SlackDate(lastUpdated / 1000 + ''),
    },
    accessory: {
      type: 'button',
      text: {
        type: 'plain_text',
        text: 'Refresh',
        emoji: true,
      },
      action_id: Routes.REFRESH_GMAIL,
    },
  },
];
