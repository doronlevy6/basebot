import { RedisUtil } from '@base/utils';

export interface FullSyncJobLock {
  lock(): Promise<boolean>;
  release(): Promise<void>;
  extend(minutes: number): Promise<void>;
}

export class RedisFullSyncJobLock extends RedisUtil implements FullSyncJobLock {
  private readonly key = 'treasury:fullsync:joblock';

  async lock(): Promise<boolean> {
    const acquired =
      (await this.db.setnx(`${this.env}:${this.key}`, '1')) === 1;
    return acquired;
  }

  async release() {
    await this.db.del(`${this.env}:${this.key}`);
  }

  async extend(minutes: number) {
    await this.db.expire(`${this.env}:${this.key}`, minutes * 60);
  }
}
