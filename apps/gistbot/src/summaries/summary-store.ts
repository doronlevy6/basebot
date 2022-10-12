import { generateIDAsync } from '../utils/id-generator.util';
import { RedisUtil } from '../utils/redis-util';

const TTL = 60 * 60; // One Hour
const BASE_KEY = 'summaries';
export interface ISummary {
  text: string;
  startDate: number;
  threadTs?: string;
}

export class SummaryStore extends RedisUtil {
  async set(summary: ISummary, key?: string): Promise<{ key: string }> {
    if (!key) {
      key = await generateIDAsync();
    }
    const fullKey = this.fullKey(key);
    await this.db.set(fullKey, JSON.stringify(summary), 'EX', TTL);
    return { key };
  }

  async get(key: string): Promise<ISummary | null> {
    const data = await this.db.get(this.fullKey(key));
    if (!data) {
      return null;
    }
    return JSON.parse(data) as ISummary;
  }

  private fullKey(key: string) {
    return [this.env, BASE_KEY, key].join(':');
  }
}
