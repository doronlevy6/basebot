import { logger } from '@base/logger';
import { NextFunction, Request, Response } from 'express';
import { PaymentsManager } from '../payments/manager';

export const stripeWebhookRoute =
  (paymentsManager: PaymentsManager) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await paymentsManager.verifyAndParseRequest(
        req.body,
        req.headers,
      );
      if (!event) {
        logger.error(`stripe webhook event verification failed`);
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false }));
        return;
      }

      logger.debug({ msg: `parsed stripe event`, event: event });
      try {
        await paymentsManager.publish(event);
        logger.debug({ msg: `sent stripe event to queue`, event: event });
      } catch (error) {
        res.writeHead(200);
        res.end(JSON.stringify({ ok: false }));
      }

      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
    } catch (error) {
      next(error);
    }
  };
