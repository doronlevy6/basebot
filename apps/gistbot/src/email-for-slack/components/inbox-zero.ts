import { KnownBlock } from '@slack/web-api';

const TEXT = `You have reached Inbox Zero!  :tada:`;

export const InboxZero = (): KnownBlock[] => {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: TEXT,
      },
    },
  ];
};
