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
import { PgInstallationStore } from './installations/installationStore';
import { ImportManager } from './imports/manager';
import { TaskStatusManager } from './task-status/manager';

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
  (importManager: ImportManager, taskStatusManager: TaskStatusManager) =>
  async () => {
    await Promise.all([importManager.close(), taskStatusManager.close()]);
  };

const startApp = async () => {
  const metricsReporter = new PrometheusReporter();

  const configuration = new Configuration({
    basePath: process.env.BASE_BACKEND_URL,
  });
  const defaultApi = new DefaultApi(configuration);
  const allQueueCfg = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10),
    password: process.env.REDIS_PASSWORD || '',
    cluster: process.env.REDIS_CLUSTER === 'true',
  };

  const importManager = new ImportManager(
    {
      prefix: `{slackbot:imports:${process.env.ENV || 'local'}}`,
      ...allQueueCfg,
    },
    defaultApi,
  );

  const pgStore = new PgInstallationStore(
    metricsReporter,
    {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      synchronize: ['development', 'local'].includes(process.env.ENV),
    },
    importManager,
  );

  const taskStatusManager = new TaskStatusManager(
    {
      prefix: `{slackbot:taskStatus:${process.env.ENV || 'local'}}`,
      ...allQueueCfg,
    },
    pgStore,
  );

  const slackApp = createApp(pgStore, metricsReporter);

  let ready = await pgStore.isReady();
  if (!ready) {
    throw new Error('PgStore is not ready');
  }
  ready = await importManager.isReady(slackApp);
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

  const port = process.env['PORT'] || 3000;
  const server = await slackApp.start(port);
  server.on('error', console.error);

  const shutdownHandler = gracefulShutdown(server);
  process.on('SIGINT', shutdownHandler);
  process.on('SIGTERM', shutdownHandler);
  process.on(
    'beforeExit',
    gracefulShutdownAsync(importManager, taskStatusManager),
  );

  // const taskStatusTriggerer = new TaskStatusTriggerer({
  //   prefix: `{slackbot:taskStatus:${process.env.ENV || 'local'}}`,
  //   ...allQueueCfg,
  // });
  // ready = await taskStatusTriggerer.isReady();
  // if (!ready) {
  //   throw new Error('TaskStatusTriggerer is not ready');
  // }
  // const creator = {
  //   id: 'u_coby',
  //   email: 'coby@base.la',
  //   organizationId: 'base.la',
  //   displayName: 'Coby',
  //   organization: undefined,
  //   externalAuthId: '',
  // };

  // const assignee1 = {
  //   id: 'u_itay',
  //   email: 'itay@base.la',
  //   organizationId: 'base.la',
  //   displayName: 'Itay',
  //   organization: undefined,
  //   externalAuthId: '',
  // };
  // const assignee2 = {
  //   id: 'u_lior',
  //   email: 'lior@base.la',
  //   organizationId: 'base.la',
  //   displayName: 'Lior',
  //   organization: undefined,
  //   externalAuthId: '',
  // };
  // const assignee3 = {
  //   id: 'u_amir',
  //   email: 'amir@base.la',
  //   organizationId: 'base.la',
  //   displayName: 'Amir',
  //   organization: undefined,
  //   externalAuthId: '',
  // };

  // const task = {
  //   id: 't_123',
  //   creator: creator,
  //   creatorId: creator.id,
  //   title: 'This is some task!',
  //   dueDate: 'Tomorrow',
  // } as Task;

  // for (let i = 0; i < 5; i++) {
  //   await taskStatusTriggerer.addTaskToQueue(assignee1, task);
  //   await taskStatusTriggerer.addTaskToQueue(assignee2, task);
  //   await taskStatusTriggerer.addTaskToQueue(assignee3, task);
  // }
};

startApp();
