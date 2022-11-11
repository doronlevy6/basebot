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
