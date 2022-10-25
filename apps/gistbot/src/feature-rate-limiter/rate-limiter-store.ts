import { RedisUtil } from '../utils/redis-util';
import { Feature } from './limits';
import { Props } from './rate-limiter';

export interface RateLimiterStore {
  increment(
    props: Props,
    bucket: string,
    feature: Feature,
    amount?: number,
  ): Promise<number>;
}

export class RedisRateLimiter extends RedisUtil implements RateLimiterStore {
  async increment(
    props: Props,
    bucket: string,
    feature: Feature,
    amount?: number,
  ): Promise<number> {
    const key = this.key(props, bucket, feature);

    if (!amount) {
      amount = 1;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [currentCount, _expiration] = await Promise.all([
      this.db.incrby(key, amount),
      // Just set the expiration to something greater than our one day window
      // so that we don't have an evergrowing database.
      // TODO: We can figure out a way to set the expiration correctly in the future
      this.db.expire(key, 60 * 60 * 24 * 2),
    ]);

    return currentCount;
  }

  private key(props: Props, bucket: string, feature: Feature): string {
    return `${this.env}:${props.teamId}:${
      props.userId
    }:${feature.toString()}:${bucket}`;
  }
}
