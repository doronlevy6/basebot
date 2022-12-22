import { logger } from '@base/logger';

interface RetryOpts {
  count: number;
  delayer?: (iteration: number) => Promise<unknown>;
  id?: string;
}

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
const defaultDelayer = (iteration: number) => delay(1000 * (iteration + 1));

export async function retry<T>(
  func: () => Promise<T>,
  opts: RetryOpts,
): Promise<T> {
  let err: Error | undefined;

  const retryId = opts.id ?? Date.now().toString();
  for (let i = 0; i < opts.count; i++) {
    try {
      logger.debug(`retry ${retryId} attempt ${i}`);
      const res = await func();
      return res;
    } catch (error) {
      err = error as Error;
      await defaultDelayer(i);
    }
  }

  if (err) {
    throw err;
  }

  throw new Error(
    'undefined behavior: never reached result and error is undefined',
  );
}
