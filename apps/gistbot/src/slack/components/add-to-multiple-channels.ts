import { KnownBlock } from '@slack/web-api';
import { Routes } from '../../routes/router';

export const AddToMultipleChannels = (): KnownBlock[] => {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Add me to more channels',
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Select a channel...',
          emoji: true,
        },
        action_id: Routes.ADD_TO_CHANNEL_FROM_WELCOME_MODAL,
      },
    },
  ];
};
