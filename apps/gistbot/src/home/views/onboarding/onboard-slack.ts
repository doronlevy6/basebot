import { KnownBlock } from '@slack/web-api';
import { Routes } from '../../../routes/router';

export const OnboardToSlackBlocks = (): KnownBlock[] => [
  {
    type: 'divider',
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Slack Digest*\nGet a personalized summary of Slack channels that matter to you',
    },
  },
  {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Choose channels',
          emoji: true,
        },
        style: 'primary',
        value: 'approve',
        action_id: Routes.OPEN_SCHEDULER_SETTINGS,
      },
    ],
  },
];
