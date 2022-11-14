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
        text: '*:one: Channel summary:*\n Simply type  `/gist ` within any channel. You can request a specific time frame by adding a number and either day or week e.g.  `/gist 3 days `',
      },
    },
    ChannelSummaryImage(),
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*:two: Thread summary:*\n Right click the thread message and tap `get theGist` .\n (You might need to search for it)',
      },
    },
    ThreadSummaryImage(),
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*:three: Scheduled summaries:*\n You can get a daily summary of your selected channels by typing `/gist settings`\n',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*:four: Mention anywhere:*\n You can also always summarize a channel or a thread by mentioning:${UserLink(
          myBotUserId,
        )}.\nKeep in mind, mentions are visible to all, the summary is still only visible to you.`,
      },
    },
  ];
};
