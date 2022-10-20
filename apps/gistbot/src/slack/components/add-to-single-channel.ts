import { KnownBlock } from '@slack/web-api';
import { Routes } from '../../routes/router';

export const AddToSingleChannel = (onBoarding: boolean): KnownBlock[] => {
  const text = addToChannelText(onBoarding);
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: text,
      },
      accessory: {
        type: 'conversations_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select a channel...',
          emoji: true,
        },
        filter: {
          include: ['public'],
          exclude_bot_users: true,
          exclude_external_shared_channels: true,
        },
        action_id: Routes.ADD_TO_CHANNEL_FROM_WELCOME_MESSAGE,
      },
    },
  ];
};
const addToChannelText = (onBoarding: boolean) => {
  if (onBoarding) {
    return `To get started, add me to a busy channel.`;
  }
  return `select a channel`;
};
