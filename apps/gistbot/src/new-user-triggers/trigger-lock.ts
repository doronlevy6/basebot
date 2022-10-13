import { RedisUtil } from '../utils/redis-util';

export class RedisTriggerLock extends RedisUtil {
  async shouldTrigger(
    triggerContext: string,
    teamId: string,
    userId: string,
    presence: string,
  ): Promise<boolean> {
    const acquired =
      (await this.db.setnx(
        this.lockKey(teamId, userId, presence, triggerContext),
        '1',
      )) === 1;

    if (acquired) {
      await this.db.expire(
        this.lockKey(teamId, userId, presence, triggerContext),
        60 * 60 * 24 * 2 /* 2 days in seconds */,
      );
    }

    return acquired;
  }

  trigger(
    teamId: string,
    userId: string,
    presence: string,
    triggerContext: string,
  ): Promise<number> {
    return this.db.incr(
      this.triggersKey(teamId, userId, presence, triggerContext),
    );
  }

  private lockKey(
    teamId: string,
    userId: string,
    presence: string,
    triggerContext: string,
  ): string {
    return `${this.env}:trigger-lock:${teamId}:${userId}:${presence}:${triggerContext}`;
  }

  private triggersKey(
    teamId: string,
    userId: string,
    presence: string,
    triggerContext: string,
  ): string {
    return `${this.env}:trigger-lock:${teamId}:${userId}:${presence}:triggers:${triggerContext}`;
  }
}
