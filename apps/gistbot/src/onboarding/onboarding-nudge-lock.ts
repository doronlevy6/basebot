import { RedisUtil } from '../utils/redis-util';

export interface OnboardingNudgeLock {
  lock(): Promise<boolean>;
  release(): Promise<void>;
  extend(minutesInterval: number): Promise<void>;
}

export class RedisOnboardingNudgeLock
  extends RedisUtil
  implements OnboardingNudgeLock
{
  private readonly lockKey = 'onboardingNudge';

  async lock(): Promise<boolean> {
    const acquired = (await this.db.setnx(this.lockKey, '1')) === 1;
    return acquired;
  }

  async release() {
    await this.db.del(this.lockKey);
  }

  async extend(minutesInterval = 30) {
    await this.db.expire(
      this.lockKey,
      minutesInterval * 60 /* interval minutes in seconds */,
    );
  }
}
