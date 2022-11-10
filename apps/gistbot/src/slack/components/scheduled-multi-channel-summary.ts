import { KnownBlock } from '@slack/bolt';
import { SchedulerSettingsButton } from './scheduler-settings-button';

export const ScheduledMultiChannelSummary = (
  formattedText: string,
): KnownBlock[] => {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: formattedText,
      },
    },
    {
      type: 'divider',
    },
    ...SchedulerSettingsButton(),
  ];
};
