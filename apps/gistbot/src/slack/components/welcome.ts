import { KnownBlock } from '@slack/web-api';
import { Routes } from '../../routes/router';
import { UserLink } from './user-link';
import { ChannelSummaryImage } from './channel-summary-image';
import { ThreadSummaryImage } from './thrad-summary-image';

export const Welcome = (userId: string, myBotUserId: string): KnownBlock[] => {
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
    {
      type: 'divider',
    },
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: "Let's get your first summary 👀",
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'To get started, add me to a busy channel.',
      },
      accessory: {
        type: 'conversations_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select a channel...',
          emoji: true,
        },
        action_id: Routes.ADD_TO_CHANNEL_FROM_WELCOME_MESSAGE,
      },
    },
  ];
};
