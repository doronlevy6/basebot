import { KnownBlock } from '@slack/web-api';
import { Routes } from '../../../routes/router';

export const EmailFooterBlocks = (): KnownBlock[] => [
  {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Email Digest settings',
          emoji: true,
        },
        action_id: Routes.EMAIL_SETTINGS_OPEN_MODAL,
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Request a feature',
          emoji: true,
        },
        action_id: Routes.SEND_USER_FEEDBACK,
      },
    ],
  },
  {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: 'This is an early beta of theGist for Gmail, we would love to hear any feedabck, just contact support@thegist.ai',
      },
    ],
  },
];
