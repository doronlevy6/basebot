import { Application } from 'express';
import * as express from 'express';
import {
  IReporter,
  expressHttpMetricsMiddleware,
  expressMetricsEndpoint,
} from '@base/metrics';
import { healthRoute } from './routes/health';
import { stripeWebhookRoute } from './routes/stripe-webhook';
import { PaymentsManager } from './payments/manager';
import { internalForceTriggerFullSyncRoute } from './routes/internal-force-trigger-fullsync';
import { logger } from '@base/logger';

export function createServer(
  metricsReporter: IReporter,
  paymentsManager: PaymentsManager,
): Application {
  const app = express();
  app.disable('x-powered-by');

  app.use(expressHttpMetricsMiddleware(metricsReporter));
  app.get('/metrics', expressMetricsEndpoint(metricsReporter));
  app.get('/health', healthRoute());

  app.post(
    '/stripe-webhook',
    express.raw({ type: 'application/json' }),
    stripeWebhookRoute(paymentsManager),
  );

  app.post(
    '/internal/trigger-fullsync',
    internalForceTriggerFullSyncRoute(paymentsManager),
  );

  // Error handler must be last in the entire thing
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err, req, res, _next) => {
    logger.error({
      message: `error caught by express global handler`,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).send('{"ok": false}');
  });

  return app;
}
