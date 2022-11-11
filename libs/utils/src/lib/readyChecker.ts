import { logger } from '@base/logger';

interface Ready {
  isReady(): Promise<boolean>;
}

export const readyChecker = async (...checks: Ready[]) => {
  const awaits = await Promise.allSettled(
    checks.map(async (c) => {
      const checkname = c.constructor?.name || 'unknown ready checker';
      logger.debug({ msg: `checking if ${checkname} is ready` });
      const ready = await c.isReady();
      if (!ready) {
        throw new Error(`${checkname} is not ready`);
      }
    }),
  );

  awaits.forEach((a, idx) => {
    if (a.status === 'rejected') {
      throw a.reason;
    }
    const checkname = checks[idx].constructor?.name || 'unknown ready checker';
    logger.debug({ msg: `${checkname} is ready` });
  });
};
