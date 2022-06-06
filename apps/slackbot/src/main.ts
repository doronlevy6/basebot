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

app.get('/api', async (req, res) => {
  const apires = await defaultApi.healthControllerCheck();
  res.send(apires.data);
});

const port = process.env['PORT'] || 3333;
const server = app.listen(port, () => {
  logger.info(`Listening at http://localhost:${port}/api`);
});
server.on('error', console.error);
