import { logger } from '@base/logger';
import { Request, Response, RequestHandler } from 'express';
import { PaymentsManager } from '../payments/manager';

export const internalForceTriggerFullSyncRoute =
  (paymentsManager: PaymentsManager): RequestHandler =>
  async (req: Request, res: Response) => {
    try {
      logger.debug({ msg: `triggering fullsync job` });
      // Return immediately and run this as an async promise
      // so that we can just trigger it manually to check it without waiting for response.
      paymentsManager
        .fullSync(100)
        .then(() => {
          logger.debug({ msg: `completed fullsync job` });
        })
        .catch((error) => {
          logger.error({
            msg: `error in fullsync job`,
            error: error.message,
            stack: error.stack,
          });
        });
    } catch (error) {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: false }));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
  };
