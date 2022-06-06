// Force import TSLib because of a bug in NX
import 'tslib';

// Before anything else runs, first we must load the environment that we are running
import { loadEnvs } from '@base/env';
import { environment } from './environments/environment';
loadEnvs(environment, ['configs', 'secrets']);

import {
  PrometheusReporter,
  expressMetricsEndpoint,
  expressHttpMetricsMiddleware,
} from '@base/metrics';
import { logger } from '@base/logger';
import { Configuration, DefaultApi } from '@base/oapigen';

import * as express from 'express';
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

const app = express();
const metricsReporter = new PrometheusReporter();
const configuration = new Configuration({
  basePath: process.env.BASE_BACKEND_URL,
});

const defaultApi = new DefaultApi(configuration);

app.use(expressHttpMetricsMiddleware(metricsReporter));
app.get('/metrics', expressMetricsEndpoint(metricsReporter));

app.get('/base/health', async (req, res) => {
  const apires = await defaultApi.healthControllerCheck();
  res.send(apires.data);
});

app.get('/health', async (req, res) => {
  const healthRes = {
    status: 'ok',
    info: {
      serviceInfo: {
        status: 'up',
        env: process.env.ENV,
        version: process.env.VERSION,
        tag: process.env.TAG,
      },
    },
    error: {},
    details: {
      serviceInfo: {
        status: 'up',
        env: process.env.ENV,
        version: process.env.VERSION,
        tag: process.env.TAG,
      },
    },
  };
  res.send(JSON.stringify(healthRes));
});

const port = process.env['PORT'] || 3333;
const server = app.listen(port, () => {
  logger.info(`Listening at http://localhost:${port}/api`);
});
server.on('error', console.error);

const shutdownHandler = gracefulShutdown(server);
process.on('SIGINT', shutdownHandler);
process.on('SIGTERM', shutdownHandler);
