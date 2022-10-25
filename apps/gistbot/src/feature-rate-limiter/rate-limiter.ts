import { Feature, FeatureLimits, SubscriptionTier } from './limits';
import { RateLimiterStore } from './rate-limiter-store';

export interface Props {
  teamId: string;
  userId: string;
}

export class FeatureRateLimiter {
  constructor(private store: RateLimiterStore) {}

  async acquire(props: Props, feature: Feature): Promise<boolean> {
    const tier = SubscriptionTier.FREE; // TODO: Tier storage and fetch by team/user
    const featureLimit = FeatureLimits[feature][tier];
    if (featureLimit === 'infinite') {
      return true;
    }

    const bucket = this.getBucket(new Date()).toFixed(0);
    const counter = await this.store.increment(props, bucket, feature);
    if (counter > featureLimit) {
      return false;
    }

    return true;
  }

  async allowMore(
    props: Props,
    feature: Feature,
    amount?: number,
  ): Promise<void> {
    if (!amount) {
      amount = 1;
    }

    const bucket = this.getBucket(new Date()).toFixed(0);
    await this.store.increment(props, bucket, feature, -1 * amount); // Increment by the negative amount that you want to allow more
  }

  private getBucket(date: Date): number {
    // Truncate to the lower day (midnight on the current day)
    // TODO: We can use the user's time zone to add truncation to the user's timezone in the future
    date.setHours(0);
    date.setMinutes(0);
    date.setSeconds(0);
    date.setMilliseconds(0);

    // Return the unix time of the truncated time
    return Math.floor(date.getTime() / 1000);
  }
}
