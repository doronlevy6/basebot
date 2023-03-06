import { KnownBlock } from '@slack/web-api';
import { Routes } from '../../../routes/router';

export const OnboardingHeaderGoProBlocks = (): KnownBlock[] => [
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*theGist*',
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
  {
    type: 'divider',
  },
];
