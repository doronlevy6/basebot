import { KnownBlock } from '@slack/bolt';
import { Routes } from '../../routes/router';

export const SchedulerSettingsOnboardingButton = (): KnownBlock[] => {
  return [
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Scheduled summaries:*\n We got you started getting a daily summary of your selected channels\n customize here 👉',
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Scheduled Summary Settings',
          emoji: true,
        },
        value: 'scheduler-settings-button',
        action_id: Routes.OPEN_SCHEDULER_SETTINGS,
      },
    },
  ];
};
