import { KnownBlock } from '@slack/web-api';

const APP_ID = process.env.SLACK_APP_ID;
const deepLink = (teamId: string) =>
  `slack://app?team=${teamId}&id=${APP_ID}&tab=messages`;
export const GoToSlackDigestBlocks = (teamId: string): KnownBlock[] => [
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:slack:  *Slack Digest*\nYour Slack digest is all set up.\n The digest is sent daily at 9:00 and can be found in your <${deepLink(
        teamId,
      )}|Messages> tab.`,
    },
  },
];
