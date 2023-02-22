import { KnownBlock } from '@slack/web-api';
import { Routes } from '../../../routes/router';

export const CreateEmailDigestBlocks = (): KnownBlock[] => [
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Gmail Digest*\nCreate your email digest',
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
