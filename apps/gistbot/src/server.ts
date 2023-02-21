import { Application } from 'express';
import * as express from 'express';
import {
  IReporter,
  expressHttpMetricsMiddleware,
  expressMetricsEndpoint,
} from '@base/metrics';
import { healthRoute } from './routes/health-route';
import { internalSessionFetcherRoute } from './routes/internal-session-fetcher-route';
import { InternalSessionFetcher } from './summaries/session-data/internal-fetcher';
import { logger } from '@base/logger';

export function createServer(
  metricsReporter: IReporter,
  internalSessionFetcher: InternalSessionFetcher,
  baseApiKey: string,
): Application {
  const app = express();
  app.disable('x-powered-by');

  app.use(expressHttpMetricsMiddleware(metricsReporter));
  app.get('/metrics', expressMetricsEndpoint(metricsReporter));
  app.get('/health', healthRoute());

  app.post(
    '/internal/feedback/fetch',
    internalSessionFetcherRoute(baseApiKey, internalSessionFetcher),
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
