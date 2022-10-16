import { KnownBlock } from '@slack/web-api';
import { ChannelSummaryImage } from './channel-summary-image';
import { ThreadSummaryImage } from './thread-summary-image';
import { UserLink } from './user-link';

export const Help = (userId: string, myBotUserId: string): KnownBlock[] => {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Hey ${UserLink(
          userId,
        )} :wave: I'm theGist.\nI’m here to help you save time by summarizing channels and threads!`,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'How to use theGist?',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*1️⃣ Channel summary -* simply type `/gist` within the channel.',
      },
    },
    ChannelSummaryImage(),
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*2️⃣ Thread summary -* click on the message menu and tap the `Get the Gist`.',
      },
    },
    ThreadSummaryImage(),
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `3️⃣ You can also always simply ask me to summarize a channel or a thread by mentioning me like this: ${UserLink(
          myBotUserId,
        )}.`,
      },
    },
  ];
};
