import { RedisUtil } from '@base/utils';

export interface SchedulerSettingsLock {
  lock(
    teamId: string,
    userId: string,
    minutesInterval: number,
  ): Promise<boolean>;
  extend(
    teamId: string,
    userId: string,
    minutesInterval: number,
  ): Promise<void>;
}

export class RedisSchedulerSettingsLock
  extends RedisUtil
  implements SchedulerSettingsLock
{
  async lock(
    teamId: string,
    userId: string,
    minutesInterval: number,
  ): Promise<boolean> {
    const acquired =
      (await this.db.setnx(this.lockKey(teamId, userId), '1')) === 1;
    await this.extend(teamId, userId, minutesInterval);
    return acquired;
  }

  async extend(teamId: string, userId: string, minutesInterval: number) {
    await this.db.expire(
      this.lockKey(teamId, userId),
      minutesInterval * 60 /* interval minutes in seconds */,
    );
  }

  private lockKey(teamId: string, userId: string): string {
    return `${this.env}:scheduler-settings-lock${teamId}:${userId}`;
  }
}
