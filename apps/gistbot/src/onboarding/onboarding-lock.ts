import { RedisUtil } from '@base/utils';

export interface OnboardingLock {
  lock(teamId: string, userId: string): Promise<boolean>;
}

export class RedisOnboardingLock extends RedisUtil implements OnboardingLock {
  async lock(teamId: string, userId: string): Promise<boolean> {
    const acquired =
      (await this.db.setnx(this.lockKey(teamId, userId), '1')) === 1;

    await this.db.expire(
      this.lockKey(teamId, userId),
      60 * 5 /* 5 minutes in seconds */,
    );

    return acquired;
  }

  private lockKey(teamId: string, userId: string): string {
    return `${this.env}:onboarding-lock:${teamId}:${userId}`;
  }
}
