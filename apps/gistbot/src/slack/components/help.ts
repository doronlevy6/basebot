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
        text: '*1️⃣ Channel summary -* simply type `/gist` within the channel. You can request a specific time frame by adding a _number_ and either _day_ or _week_ e.g. `/gist 3 days`',
      },
    },
    ChannelSummaryImage(),
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*2️⃣ Thread summary -* click on the message menu and tap `Get theGist`.',
      },
    },
    ThreadSummaryImage(),
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `3️⃣ You can simply mention ${UserLink(
          myBotUserId,
        )} in a channel or thread to get a summary, however keep in mind that everyone in the channel can see the mention (the summary is still only visible to you).`,
      },
    },
  ];
};
