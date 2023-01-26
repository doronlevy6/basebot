import { KnownBlock } from '@slack/web-api';
import { UserLink } from './user-link';

const createGmailUrl = (userId: string, teamId: string) => {
  const BASE_URL = process.env.MAIL_BOT_OAUTH_API || '';
  const url = new URL(BASE_URL);
  url.pathname = '/mail/oauth-public';
  const params = new URLSearchParams();
  params.set('user', userId);
  params.set('team', teamId);
  url.search = params.toString();
  return url.toString();
};

export const ConnectToGmail = (
  userId: string,
  teamId: string,
): KnownBlock[] => {
  return [
    {
      type: 'image',
      image_url: 'https://assets.thegist.ai/gist/assets/theGist_email.jpg',
      alt_text: 'inspiration',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Hi ${UserLink(
          userId,
        )} we are happy to introduce ✨theGist for Gmail✨ get actionable summaries of your email, directly here.\n • Personalized summaries\n • Smart grouping \n• Bulk actions that make sense\n • Magic replies with AI`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Sign in with Gmail',
            emoji: true,
          },
          style: 'primary',
          url: createGmailUrl(userId, teamId),
          value: 'click_me_123',
        },
      ],
    },
  ];
};
