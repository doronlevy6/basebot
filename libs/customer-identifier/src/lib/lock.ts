import { RedisUtil } from '@base/utils';

export interface CustomerIdentifierLock {
  lock(customerId: string): Promise<boolean>;
}

export class RedisCustomerIdentifierLock
  extends RedisUtil
  implements CustomerIdentifierLock
{
  private readonly prefix = 'treasury:customer-identifier';

  async lock(customerId: string): Promise<boolean> {
    const acquired = (await this.db.setnx(this.lockKey(customerId), '1')) === 1;
    await this.db.expire(this.lockKey(customerId), 60 * 15);
    return acquired;
  }

  private lockKey(customerId: string): string {
    return `${this.env}:${this.prefix}:lock:${customerId}`;
  }
}
