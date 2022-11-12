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

export function createServer(
  metricsReporter: IReporter,
  paymentsManager: PaymentsManager,
): Application {
  const app = express();
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

  return app;
}
