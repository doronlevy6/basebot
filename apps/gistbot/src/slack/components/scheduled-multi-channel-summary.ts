import { KnownBlock } from '@slack/bolt';
import { UserSchedulerOptions } from '../../summary-scheduler/types';
import { GoProScheduler } from './go-pro-scheduler';
import { MultiChannelSummary } from './multi-channel-summary';

export const ScheduledMultiChannelSummary = (
  formattedSummaries: string[],
  limit: number,
  nonIncludedChannedIds: string[],
  sessionId: string,
  selectedTime: number,
): KnownBlock[] => {
  const timeStr =
    selectedTime === Number(UserSchedulerOptions.MORNING)
      ? 'morning'
      : 'afternoon';
  const title = `*Good ${timeStr}, here is your daily digest:*\n`;
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: title,
      },
    },
    ...MultiChannelSummary(formattedSummaries, sessionId),
    {
      type: 'divider',
    },
    ...GoProScheduler(limit, nonIncludedChannedIds),
  ];
};
