import { KnownBlock } from '@slack/bolt';
import { GoProScheduler } from './go-pro-scheduler';
import { MultiChannelSummary } from './multi-channel-summary';

export const ScheduledMultiChannelSummary = (
  formattedSummaries: string[],
  limit: number,
  nonIncludedChannedIds: string[],
  sessionId: string,
): KnownBlock[] => {
  return [
    ...MultiChannelSummary(formattedSummaries, sessionId),
    {
      type: 'divider',
    },
    ...GoProScheduler(limit, nonIncludedChannedIds),
  ];
};
