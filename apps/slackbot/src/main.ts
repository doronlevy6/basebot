// Force import TSLib because of a bug in NX
import 'tslib';

// Before anything else runs, first we must load the environment that we are running
import { loadEnvs } from '@base/env';
import { environment } from './environments/environment';
loadEnvs(environment, ['configs', 'secrets']);

import { logger } from '@base/logger';
import { PrometheusReporter, slackBoltMetricsMiddleware } from '@base/metrics';
import { Server } from 'http';
import { createApp } from './app';
import { ImportController } from './imports/controller';
import { PgInstallationStore } from './installations/installationStore';
import { TaskStatusManager } from './task-status/manager';
import { TaskStatusTriggerer } from './task-status/triggerer_tester';
import { Configuration, SlackbotApiApi as SlackbotApi } from '@base/oapigen';
import { registerSlackbotEvents } from '../../routes/router';
import { runTestExample } from './task-status/tasks_example_test';
import { AnalyticsManager } from './analytics/analytics-manager';

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

const gracefulShutdownAsync =
  (importManager: ImportController, taskStatusManager: TaskStatusManager) =>
  async () => {
    await Promise.all([importManager.close(), taskStatusManager.close()]);
  };

const startApp = async () => {
  const metricsReporter = new PrometheusReporter();

  const allQueueCfg = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10),
    password: process.env.REDIS_PASSWORD || '',
    cluster: process.env.REDIS_CLUSTER === 'true',
  };

  const pgStore = new PgInstallationStore(metricsReporter, {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: ['development', 'local'].includes(process.env.ENV),
  });

  const baseApi = new SlackbotApi(
    new Configuration({
      basePath: process.env.BASE_BACKEND_URL,
      accessToken: process.env.BASE_API_KEY,
    }),
  );

  AnalyticsManager.initialize({
    prefix: `{base:queues:${process.env.ENV || 'local'}}`,
    ...allQueueCfg,
  });

  const taskStatusManager = new TaskStatusManager(
    {
      prefix: `{base:queues:${process.env.ENV || 'local'}}`,
      ...allQueueCfg,
    },
    pgStore,
  );

  const importController = new ImportController({
    prefix: `{base:queues:${process.env.ENV || 'local'}}`,
    ...allQueueCfg,
  });

  const slackApp = createApp(
    pgStore,
    metricsReporter,
    importController,
    baseApi,
  );

  let ready = await pgStore.isReady();
  if (!ready) {
    throw new Error('PgStore is not ready');
  }
  ready = await importController.isReady();
  if (!ready) {
    throw new Error('ImportManager is not ready');
  }
  ready = await taskStatusManager.isReady();
  if (!ready) {
    throw new Error('TaskStatusManager is not ready');
  }

  slackApp.use(slackBoltMetricsMiddleware(metricsReporter));
  slackApp.event('message', async ({ event, logger }) => {
    logger.info(event);
  });

  registerSlackbotEvents(slackApp, baseApi);

  const port = process.env['PORT'] || 3000;
  const server = await slackApp.start(port);
  server.on('error', console.error);

  const shutdownHandler = gracefulShutdown(server);
  process.on('SIGINT', shutdownHandler);
  process.on('SIGTERM', shutdownHandler);
  process.on(
    'beforeExit',
    gracefulShutdownAsync(importController, taskStatusManager),
  );

  const taskStatusTriggerer = new TaskStatusTriggerer({
    prefix: `{base:queues:${process.env.ENV || 'local'}}`,
    ...allQueueCfg,
  });
  ready = await taskStatusTriggerer.isReady();
  if (!ready) {
    throw new Error('TaskStatusTriggerer is not ready');
  }
  runTestExample(taskStatusTriggerer);
};

startApp();
