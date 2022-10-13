import { RedisUtil } from '../utils/redis-util';

export class RedisTriggerLock extends RedisUtil {
  async shouldTrigger(
    teamId: string,
    userId: string,
    presence: string,
  ): Promise<boolean> {
    const acquired =
      (await this.db.setnx(this.lockKey(teamId, userId, presence), '1')) === 1;

    if (acquired) {
      await this.db.expire(
        this.lockKey(teamId, userId, presence),
        60 * 60 * 24 * 2 /* 2 days in seconds */,
      );
    }

    return acquired;
  }

  trigger(teamId: string, userId: string, presence: string): Promise<number> {
    return this.db.incr(this.triggersKey(teamId, userId, presence));
  }

  private lockKey(teamId: string, userId: string, presence: string): string {
    return `${this.env}:trigger-lock:${teamId}:${userId}:${presence}`;
  }

  private triggersKey(
    teamId: string,
    userId: string,
    presence: string,
  ): string {
    return `${this.env}:trigger-lock:${teamId}:${userId}:${presence}:triggers`;
  }
}
