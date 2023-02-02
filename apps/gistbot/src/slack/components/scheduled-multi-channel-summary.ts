import { KnownBlock } from '@slack/bolt';
import { UserSchedulerOptions } from '../../summary-scheduler/types';
import { ChatIntroBanner } from './chat-intro-banner';
import { GoProScheduler } from './go-pro-scheduler';
import { GoExProScheduler } from './go-ex-pro-scheduler';
import { MultiChannelSummary } from './multi-channel-summary';
import { SubscriptionTier } from '@base/customer-identifier';

export const ScheduledMultiChannelSummary = (
  formattedSummaries: string[],
  limit: number,
  tier: string,
  nonIncludedChannedIds: string[],
  sessionId: string,
  selectedTime: number,
  userId: string,
): KnownBlock[] => {
  const timeStr =
    selectedTime === Number(UserSchedulerOptions.MORNING)
      ? 'morning'
      : 'afternoon';
  const title = `*Good ${timeStr}, here is your daily digest:*\n`;
  const goProBtn =
    tier === SubscriptionTier.PRO
      ? GoExProScheduler(limit, nonIncludedChannedIds)
      : GoProScheduler(limit, nonIncludedChannedIds);

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
    ...goProBtn,
    {
      type: 'divider',
    },
    ...ChatIntroBanner(userId),
  ];
};
