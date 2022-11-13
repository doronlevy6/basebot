import { KnownBlock } from '@slack/bolt';
import { GoProScheduler } from './go-pro-scheduler';
import { SchedulerSettingsButton } from './scheduler-settings-button';

export const ScheduledMultiChannelSummary = (
  formattedText: string,
  limit: number,
  nonIncludedChannedIds: string[],
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
    {
      type: 'divider',
    },
    ...GoProScheduler(limit, nonIncludedChannedIds),
  ];
};
