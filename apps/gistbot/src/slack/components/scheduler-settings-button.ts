import { KnownBlock } from '@slack/bolt';
import { Routes } from '../../routes/router';

export const SchedulerSettingsButton = (): KnownBlock[] => {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Add/remove channels, change timing or turn off 👉',
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Daily Summary Settings',
          emoji: true,
        },
        value: 'scheduler-settings-button',
        action_id: Routes.OPEN_SCHEDULER_SETTINGS,
      },
    },
  ];
};
