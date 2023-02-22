import { KnownBlock } from '@slack/web-api';

export const InboxZeroBlocks = (): KnownBlock[] => [
  {
    type: 'header',
    text: {
      type: 'plain_text',
      text: 'Congratulations you have reached inbox zero 🎉',
      emoji: true,
    },
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '✨ There are no new unread emails ✨',
    },
  },
];
