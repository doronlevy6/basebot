import { SubscriptionTier } from '@base/customer-identifier';

export enum Feature {
  SUMMARY = 'SUMMARY',
  SCHEDULED_SUMMARIES = 'SCHEDULED_SUMMARIES',
  CHAT = 'CHAT',
}

type featureLimit = Record<
  keyof typeof Feature,
  Record<keyof typeof SubscriptionTier, number | 'infinite'>
>;

export const FeatureLimits: featureLimit = {
  [Feature.SUMMARY]: {
    [SubscriptionTier.FREE]: 5,
    [SubscriptionTier.PRO]: 'infinite',
    [SubscriptionTier.ENTERPRISE]: 'infinite',
  },
  [Feature.SCHEDULED_SUMMARIES]: {
    [SubscriptionTier.FREE]: 3,
    [SubscriptionTier.PRO]: 12,
    [SubscriptionTier.ENTERPRISE]: 12,
  },
  [Feature.CHAT]: {
    [SubscriptionTier.FREE]: 2,
    [SubscriptionTier.PRO]: 'infinite',
    [SubscriptionTier.ENTERPRISE]: 'infinite',
  },
};
