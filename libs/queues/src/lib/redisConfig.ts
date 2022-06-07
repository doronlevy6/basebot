import * as IORedis from 'ioredis';
import { IQueueConfig } from './types';

export function createRedis(
  cfg: IQueueConfig,
): IORedis.Redis | IORedis.Cluster {
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
