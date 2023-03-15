// Force import TSLib because of a bug in NX
import 'tslib';

// Before anything else runs, first we must load the environment that we are running
import { loadEnvs } from '@base/env';
import { environment } from './environments/environment';
loadEnvs(environment, ['configs']);

import { logger } from '@base/logger';
import { PrometheusReporter, slackBoltMetricsMiddleware } from '@base/metrics';
import { Server } from 'http';
import { AnalyticsManager, PgInstallationStore } from '@base/gistbot-shared';
import { SqsPublisher, EventBridgePublisher } from '@base/pubsub';
import { readyChecker } from '@base/utils';
import { createApp } from './slack-bolt-app';
import { registerBoltAppRouter } from './routes/router';

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

// Anything that needs to shutdown in an asynchronous way should be added here
const gracefulShutdownAsync = (analyticsManager: AnalyticsManager) => {
  return async () => {
    await Promise.all([analyticsManager.close()]);
  };
};

const startApp = async () => {
  const metricsReporter = new PrometheusReporter();

  const env =
    process.env.ENV ||
    'local'; /* We are defaulting to local env to be explicit */

  const analyticsManager = new AnalyticsManager();

  const pgConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || '',
    synchronize: ['development', 'local'].includes(env),
  };
  const pgStore = new PgInstallationStore(metricsReporter, pgConfig);

  const sqsRegion = process.env.AWS_REGION;
  const sqsBaseUrl = process.env.SQS_BASE_URL;
  const sqsAccountId = process.env.AWS_ACCOUNT_ID;
  const slackEventsQueueName = process.env.SLACK_SQS_QUEUE_NAME;
  if (!sqsRegion || !sqsBaseUrl || !sqsAccountId || !slackEventsQueueName) {
    throw new Error('missing sqs details in configs');
  }

  const sqsConfig = {
    baseUrl: sqsBaseUrl,
    region: sqsRegion,
    accountId: sqsAccountId,
  };
  const sqsPublisher = new SqsPublisher(sqsConfig);

  const eventBridgeUrl = process.env.EVENTBRIDGE_BASE_URL;
  const eventBridgeName = process.env.EVENT_BRIDGE_NAME;
  const eventBridgeRegion = process.env.EVENT_BRIDGE_REGION;
  if (!eventBridgeUrl || !eventBridgeName || !eventBridgeRegion) {
    throw new Error('missing eventbridge details in configs');
  }
  const eventBridgePublisher = new EventBridgePublisher({
    env: env,
    serviceName: 'slacker',
    bridge: eventBridgeName,
    region: eventBridgeRegion,
    baseUrl: eventBridgeUrl,
  });

  // readyChecker is a small util for all things that implement `isReady`. It will
  // check to see if all of these are ready and throw an error if one isn't.
  await readyChecker(analyticsManager, pgStore);

  const slackApp = createApp(pgStore, metricsReporter, analyticsManager);
  slackApp.use(slackBoltMetricsMiddleware(metricsReporter));
  registerBoltAppRouter(
    slackApp,
    sqsPublisher,
    slackEventsQueueName,
    eventBridgePublisher,
  );

  const port = process.env['PORT'] || 3000;
  const server = await slackApp.start(port);
  server.on('error', console.error);

  const shutdownHandler = gracefulShutdown(server);
  process.on('SIGINT', shutdownHandler);
  process.on('SIGTERM', shutdownHandler);

  // The 'beforeExit' event is supposed to allow promises and is the place where
  // we are supposed to do graceful async shutdowns. Not sure why the signature
  // doesn't accept a promise...
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  process.on('beforeExit', gracefulShutdownAsync(analyticsManager));
};

// eslint-disable-next-line @typescript-eslint/no-floating-promises
startApp();
