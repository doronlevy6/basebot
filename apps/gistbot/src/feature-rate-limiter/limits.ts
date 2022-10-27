export enum SubscriptionTier {
  FREE = 'FREE',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export const SubscriptionTiers = Object.values(SubscriptionTier);

export const SubscriptionTierFromString = (
  s: string,
): SubscriptionTier | undefined => {
  return SubscriptionTiers.find((st) => {
    return s.toUpperCase() == st.toUpperCase();
  });
};

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
