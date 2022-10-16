import { KnownBlock } from '@slack/web-api';
import { Routes } from '../../routes/router';
import { Help } from './help';

export const Welcome = (userId: string, myBotUserId: string): KnownBlock[] => {
  return [
    ...Help(userId, myBotUserId),
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
