import { Application } from 'express';
import * as express from 'express';
import {
  IReporter,
  expressHttpMetricsMiddleware,
  expressMetricsEndpoint,
} from '@base/metrics';
import { healthRoute } from './routes/health';

export function createServer(metricsReporter: IReporter): Application {
  const app = express();
  app.use(expressHttpMetricsMiddleware(metricsReporter));
  app.get('/metrics', expressMetricsEndpoint(metricsReporter));
  app.get('/health', healthRoute());

  return app;
}
