import { KnownBlock } from '@slack/web-api';

const APP_ID = process.env.SLACK_APP_ID;
const deepLink = (teamId: string) =>
  `slack://app?team=${teamId}&id=${APP_ID}&tab=messages`;
export const GoToSlackDigestBlocks = (teamId: string): KnownBlock[] => [
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: ':slack:  *Slack Digest *\nYour Daily Digset is waiting for you in messages',
    },
    accessory: {
      type: 'button',
      text: {
        type: 'plain_text',
        text: 'See Digest',
        emoji: true,
      },

      url: deepLink(teamId),
    },
  },
];
