interface RetryOpts {
  count: number;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function retry<T>(
  func: () => Promise<T>,
  opts: RetryOpts,
): Promise<T> {
  let err: Error | undefined;

  for (let i = 0; i < opts.count; i++) {
    try {
      const res = await func();
      return res;
    } catch (error) {
      err = error as Error;
      await delay(1000 * (i + 1));
    }
  }

  if (err) {
    throw err;
  }

  throw new Error(
    'undefined behavior: never reached result and error is undefined',
  );
}
