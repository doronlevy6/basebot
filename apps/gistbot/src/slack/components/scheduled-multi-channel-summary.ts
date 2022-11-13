import { KnownBlock } from '@slack/bolt';
import { GoProScheduler } from './go-pro-scheduler';
import { MultiChannelSummary } from './multi-channel-summary';
import { SchedulerSettingsButton } from './scheduler-settings-button';

export const ScheduledMultiChannelSummary = (
  formattedText: string,
  limit: number,
  nonIncludedChannedIds: string[],
  sessionId: string,
): KnownBlock[] => {
  return [
    ...MultiChannelSummary(formattedText, sessionId),
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
