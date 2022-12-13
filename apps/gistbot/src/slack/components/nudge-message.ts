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
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          style: 'primary',
          text: {
            type: 'plain_text',
            text: 'Daily Digest Settings',
          },
          value: 'scheduler-settings-button',
          action_id: Routes.OPEN_SCHEDULER_SETTINGS,
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: RemoveNudge,
      },
      accessory: {
        type: 'button',
        style: 'danger',
        text: {
          type: 'plain_text',
          text: 'Unsubscribe',
        },
        value: 'scheduler-settings-button',
        action_id: Routes.STOP_NUDGE_MESSAGES,
      },
    },
  ];
};

export const NudgeMessageText = `Hey there,\n most users use theGist to get a daily digest of their busiest channels in slack, you can set up your daily digest here`;
export const RemoveNudge = `Click here to stop receiving these messages`;
