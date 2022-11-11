import { logger } from '@base/logger';
import redis, { Cluster, Redis } from 'ioredis';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  cluster: boolean;
}

export class RedisUtil {
  protected db: Redis | Cluster;

  constructor(cfg: RedisConfig, protected env: string) {
    this.db = this.createRedis(cfg);
  }

  private createRedis(cfg: RedisConfig): Redis | Cluster {
    if (cfg.cluster) {
      return new Cluster(
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

    return new redis({
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
}
