// Force import TSLib because of a bug in NX
import 'tslib';

// Before anything else runs, first we must load the environment that we are running
import { loadEnvs } from '@base/env';
import { environment } from './environments/environment';
loadEnvs(environment, ['configs', 'secrets']);

import { logger } from '@base/logger';
import { PrometheusReporter, slackBoltMetricsMiddleware } from '@base/metrics';
import { Configuration, SlackbotApiApi as SlackbotApi } from '@base/oapigen';
import { Server } from 'http';
import { AnalyticsManager } from './analytics/analytics-manager';
import { ImportController } from './imports/controller';
import { PgInstallationStore } from './installations/installationStore';
import { Messenger } from './messenger/messenger';
import { registerSlackbotEvents } from './routes/router';
import { createApp } from './slack-bolt-app';
import { TasksManager } from './tasks/manager';
import { NudgeManager } from './nudge/nudge-manager';

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
  (
    importManager: ImportController,
    taskStatusManager: TasksManager,
    nudgeManager: NudgeManager,
    messenger: Messenger,
  ) =>
  async () => {
    await Promise.all([
      importManager.close(),
      taskStatusManager.close(),
      nudgeManager.close(),
      messenger.close(),
      AnalyticsManager.close(),
    ]);
  };

const startApp = async () => {
  const metricsReporter = new PrometheusReporter();

  const allQueueCfg = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    cluster: process.env.REDIS_CLUSTER === 'true',
    prefix: `{base:queues:${process.env.ENV || 'local'}}`,
  };

  const pgStore = new PgInstallationStore(metricsReporter, {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || '',
    synchronize: ['development', 'local'].includes(
      process.env.ENV ||
        'local' /* We are defaulting to local env to be explicit */,
    ),
  });

  const baseApi = new SlackbotApi(
    new Configuration({
      basePath: process.env.BASE_BACKEND_URL,
      accessToken: process.env.BASE_API_KEY,
    }),
  );

  AnalyticsManager.initialize(allQueueCfg);

  const taskStatusManager = new TasksManager(allQueueCfg, pgStore);

  const nudgeManager = new NudgeManager(allQueueCfg, pgStore);

  const importController = new ImportController(allQueueCfg, pgStore);

  const messenger = new Messenger(allQueueCfg, pgStore);

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
  ready = await nudgeManager.isReady();
  if (!ready) {
    throw new Error('NudgeManager is not ready');
  }
  ready = await messenger.isReady();
  if (!ready) {
    throw new Error('Messenger is not ready');
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
    gracefulShutdownAsync(
      importController,
      taskStatusManager,
      nudgeManager,
      messenger,
    ),
  );
};

startApp();
