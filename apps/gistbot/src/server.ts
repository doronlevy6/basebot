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

export function createServer(
  metricsReporter: IReporter,
  internalSessionFetcher: InternalSessionFetcher,
  baseApiKey: string,
): Application {
  const app = express();
  app.use(expressHttpMetricsMiddleware(metricsReporter));
  app.get('/metrics', expressMetricsEndpoint(metricsReporter));
  app.get('/health', healthRoute());

  app.post(
    '/internal/feedback/fetch',
    internalSessionFetcherRoute(baseApiKey, internalSessionFetcher),
  );

  return app;
}
