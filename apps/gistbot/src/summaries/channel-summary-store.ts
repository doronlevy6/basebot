import { RedisUtil } from '@base/utils';
import { OutputSummary } from './channel/multi-channel-summarizer';
import { logger } from '@base/logger';

const TTL = 60 * 60; // One Hour
const BASE_KEY = 'channel_summaries';

export class ChannelSummaryStore extends RedisUtil {
  async set(
    summary: OutputSummary,
    channelId: string,
    teamId: string,
  ): Promise<{ key: string }> {
    const fullKey = this.fullKey(channelId, teamId);
    await this.db.set(fullKey, JSON.stringify(summary), 'EX', TTL);
    return { key: fullKey };
  }

  async get(channelId: string, teamId: string): Promise<OutputSummary | null> {
    const data = await this.db.get(this.fullKey(channelId, teamId));
    if (!data) {
      return null;
    }
    logger.debug(`cache hit for channel summary at key ${channelId} ${teamId}`);
    return JSON.parse(data) as OutputSummary;
  }

  private fullKey(channelId: string, teamId: string) {
    return [this.env, BASE_KEY, channelId, teamId].join(':');
  }
}
