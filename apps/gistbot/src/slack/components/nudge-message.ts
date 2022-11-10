import { KnownBlock } from '@slack/web-api';
import { Routes } from '../../routes/router';
export const NudgeMessage = (): KnownBlock[] => {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: NudgeMessageText,
      },
      accessory: {
        type: 'multi_conversations_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select channels...',
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

export const NudgeMessageText = `You haven't added me to any channel yet 🥺. theGist likes channels 👉`;
