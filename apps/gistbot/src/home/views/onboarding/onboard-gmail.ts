import { KnownBlock } from '@slack/web-api';
import { createGmailAuthUrl } from '../../../slack/components/connect-to-gmail';

export const OnboardToGmailBlocks = (
  slackUserId: string,
  slackTeamId: string,
): KnownBlock[] => [
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Gmail Digest*\nClear your inbox in seconds with an actionable categorized summary of your Gmail.',
    },
  },
  {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Connect Gmail',
          emoji: true,
        },
        style: 'primary',
        url: createGmailAuthUrl(slackUserId, slackTeamId),
      },
    ],
  },
];
