import { KnownBlock } from '@slack/web-api';
import { Routes } from '../../routes/router';

const NUDGE_IMG = 'https://assets.thegist.ai/gist/assets/nudge.jpg';

export const NudgeMessage = (): KnownBlock[] => {
  return [
    {
      type: 'image',
      title: {
        type: 'plain_text',
        text: 'Complete your digest set up',
        emoji: true,
      },
      image_url: NUDGE_IMG,
      alt_text: 'your personalized daily digiest is just a tap away',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Select channels for your personal daily digest :point_right:',
      },
      accessory: {
        type: 'button',

        text: {
          type: 'plain_text',
          text: 'Daily Digest Settings',
        },
        value: 'scheduler-settings-button',
        action_id: Routes.OPEN_SCHEDULER_SETTINGS,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: `Don't ask me again, thanks`,
            emoji: true,
          },
          value: 'nudge-canceling-button',
          action_id: Routes.STOP_NUDGE_MESSAGES,
        },
      ],
    },
  ];
};

export const NudgeMessageText = `Hey there,\n most users use theGist to get a daily digest of their busiest channels in slack, you can set up your daily digest here`;
