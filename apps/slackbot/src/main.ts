// Force import TSLib because of a bug in NX
import 'tslib';

// Before anything else runs, first we must load the environment that we are running
import { loadEnvs } from '@base/env';
import { environment } from './environments/environment';
loadEnvs(environment, ['configs', 'secrets']);

import { PrometheusReporter, slackBoltMetricsMiddleware } from '@base/metrics';
import { logger } from '@base/logger';
import { Configuration, DefaultApi } from '@base/oapigen';
import { createApp } from './app';
import { Server } from 'http';

const gracefulShutdown = (server: Server) => (signal: string) => {
  logger.info('starting shutdown, got signal ' + signal);
  if (!server.listening) process.exit(0);

  server.close((err) => {
    if (err) {
      logger.error(err);
      return process.exit(1);
    }
    process.exit(0);
  });
};

const startApp = async () => {
  const metricsReporter = new PrometheusReporter();

  const configuration = new Configuration({
    basePath: process.env.BASE_BACKEND_URL,
  });
  const defaultApi = new DefaultApi(configuration);

  // TODO: database
  const slackApp = createApp(null, defaultApi, metricsReporter);
  slackApp.use(slackBoltMetricsMiddleware(metricsReporter));

  const port = process.env['PORT'] || 3000;
  const server = await slackApp.start(port);
  server.on('error', console.error);

  const shutdownHandler = gracefulShutdown(server);
  process.on('SIGINT', shutdownHandler);
  process.on('SIGTERM', shutdownHandler);
};

startApp();
