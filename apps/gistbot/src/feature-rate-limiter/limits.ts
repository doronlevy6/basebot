export enum SubscriptionTier {
  FREE = 'FREE',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum Feature {
  SUMMARY = 'SUMMARY',
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
};
