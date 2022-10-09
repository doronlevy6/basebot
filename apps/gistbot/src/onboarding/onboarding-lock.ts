import { logger } from '@base/logger';
import * as IORedis from 'ioredis';

export interface OnboardingLock {
  lock(teamId: string, userId: string): Promise<boolean>;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  cluster: boolean;
}

export class RedisOnboardingLock implements OnboardingLock {
  private db: IORedis.Redis | IORedis.Cluster;

  constructor(cfg: RedisConfig, private env: string) {
    this.db = this.createRedis(cfg);
  }

  private createRedis(cfg: RedisConfig): IORedis.Redis | IORedis.Cluster {
    if (cfg.cluster) {
      return new IORedis.Cluster(
        [
          {
            host: cfg.host,
            port: cfg.port,
          },
        ],
        {
          redisOptions: { password: cfg.password, maxRetriesPerRequest: null },
          enableOfflineQueue: false,
        },
      );
    }

    return new IORedis.default({
      host: cfg.host,
      port: cfg.port,
      password: cfg.password,
      enableOfflineQueue: false,
      maxRetriesPerRequest: null,
    });
  }

  async isReady(): Promise<boolean> {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < 10; i++) {
      try {
        await this.db.ping();
        return true;
      } catch (error) {
        logger.error(`error pinging the database: ${error}`);
      }
      await delay(1000 * i); // Wait for (number of seconds * loop number) so that we try a few times before giving up
    }

    return false;
  }

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
