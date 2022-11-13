import { SubscriptionTier } from '@base/customer-identifier';

export enum Feature {
  SUMMARY = 'SUMMARY',
  SCHEDULED_SUMMARIES = 'SCHEDULED_SUMMARIES',
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
    [SubscriptionTier.FREE]: 2,
    [SubscriptionTier.PRO]: 8,
    [SubscriptionTier.ENTERPRISE]: 8,
  },
};
