import { KnownBlock } from '@slack/web-api';
import { UserLink } from '../../../slack/components/user-link';

export const OnboardingHeaderBlocks = (userId: string): KnownBlock[] => [
  {
    type: 'header',
    text: {
      type: 'plain_text',
      text: 'Welcome to theGist',
      emoji: true,
    },
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `Hey ${UserLink(
        userId,
      )} I'm theGist.👋\nI’m here to help you save time by summarizing Slack and Gmail for you.`,
    },
  },
  {
    type: 'header',
    text: {
      type: 'plain_text',
      text: "Let's start",
      emoji: true,
    },
  },
];
