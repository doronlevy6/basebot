// Before anything else runs, first we must load the environment that we are running
import { loadEnvs } from '@base/env';
import { environment } from './environments/environment';
loadEnvs(environment, ['configs', 'secrets']);

import {
  PrometheusReporter,
  expressMetricsEndpoint,
  expressHttpMetricsMiddleware,
} from '@base/metrics';
import * as express from 'express';
import { logger } from '@base/logger';

import { Configuration, DefaultApi } from '@base/oapigen';

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
