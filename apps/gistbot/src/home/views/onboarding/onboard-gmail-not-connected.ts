import { KnownBlock } from '@slack/web-api';
import { createGmailAuthUrl } from '../../../slack/components/connect-to-gmail';
import { UserLink } from '../../../slack/components/user-link';

export const OnboardToGmailNotConnectedBlocks = (
  slackUserId: string,
  slackTeamId: string,
): KnownBlock[] => [
  {
    type: 'image',
    image_url: 'https://assets.thegist.ai/gist/assets/the_gist_for_gmail.jpeg',
    alt_text: 'inspiration',
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `Hi ${UserLink(
        slackUserId,
      )} we are happy to introduce ✨theGist for Gmail✨ get actionable summaries of your email, directly here.\n- Personalized summaries\n- Smart grouping\n- Bulk actions that make sense`,
    },
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: "*Let's get started*",
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
