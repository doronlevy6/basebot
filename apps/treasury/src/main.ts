// Force import TSLib because of a bug in NX
import 'tslib';

// Before anything else runs, first we must load the environment that we are running
import { loadEnvs } from '@base/env';
import { environment } from './environments/environment';
loadEnvs(environment, ['configs']);

import { logger } from '@base/logger';
import { PrometheusReporter } from '@base/metrics';
import { Server } from 'http';
import { createServer } from './server';
import { PaymentsManager } from './payments/manager';
import { SqsPublisher, SqsConsumer } from '@base/pubsub';
import { RedisFullSyncJobLock } from './payments/joblock';
import { PgConfig, readyChecker, RedisConfig } from '@base/utils';
import {
  CustomerIdentifier,
  PgCustomerStore,
  RedisCustomerIdentifierLock,
  SubscriptionManager,
} from '@base/customer-identifier';
import { EmailSender } from '@base/emailer';

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
const gracefulShutdownAsync = (sqsConsumer: SqsConsumer) => {
  return async () => {
    await Promise.all([sqsConsumer.stop()]);
  };
};

const startApp = async () => {
  const metricsReporter = new PrometheusReporter();

  const env =
    process.env.ENV ||
    'local'; /* We are defaulting to local env to be explicit */

  const stripeApiKey = process.env.STRIPE_API_KEY;
  if (!stripeApiKey) {
    throw new Error('stripe api key is missing in secrets');
  }
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeWebhookSecret) {
    throw new Error('stripe webhook secret is missing in secrets');
  }
  const sqsRegion = process.env.SQS_REGION;
  const sqsBaseUrl = process.env.SQS_BASE_URL;
  const sqsAccountId = process.env.SQS_ACCOUNT_ID;
  const stripeEventsQueueName = process.env.STRIPE_SQS_QUEUE_NAME;
  if (!sqsRegion || !sqsBaseUrl || !sqsAccountId || !stripeEventsQueueName) {
    throw new Error('missing sqs details in configs');
  }

  const sqsConfig = {
    baseUrl: sqsBaseUrl,
    region: sqsRegion,
    accountId: sqsAccountId,
  };
  const sqsPublisher = new SqsPublisher(sqsConfig);

  const redisConfig: RedisConfig = {
    host: process.env.REDIS_HOST || '',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    cluster: process.env.REDIS_CLUSTER === 'true',
  };
  const pgConfig: PgConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || '',
    synchronize: ['development', 'local'].includes(env),
  };

  const customerStore = new PgCustomerStore(pgConfig);
  const customerIdentifierLock = new RedisCustomerIdentifierLock(
    redisConfig,
    env,
  );
  const emailSender = new EmailSender(
    process.env.SENDGRID_API_KEY || '',
    'welcome@mail.thegist.ai',
  );
  const customerIdentifier = new CustomerIdentifier(
    customerStore,
    customerIdentifierLock,
    emailSender,
    'https://slack.com/app_redirect?app=A043A1099D1',
  );
  const subscriptionManager = new SubscriptionManager(
    customerStore,
    stripeApiKey,
  );

  const fullSyncJobLock = new RedisFullSyncJobLock(redisConfig, env);

  const paymentsManager = new PaymentsManager({
    stripeApiKey,
    stripeWebhookSecret,
    stripeEventsQueue: stripeEventsQueueName,
    publisher: sqsPublisher,
    lock: fullSyncJobLock,
    customerIdentifier: customerIdentifier,
    subscriptionManager: subscriptionManager,
  });

  const sqsConsumer = new SqsConsumer(sqsConfig, (msg) => {
    return paymentsManager.consume(msg);
  });

  // readyChecker is a small util for all things that implement `isReady`. It will
  // check to see if all of these are ready and throw an error if one isn't.
  await readyChecker(customerStore, customerIdentifierLock, fullSyncJobLock);

  const app = createServer(metricsReporter, paymentsManager);
  const port = process.env['PORT'] || 3000;
  const server = app.listen(port, () => {
    logger.debug(`running ${env} server on port ${port}`);
  });

  server.on('error', console.error);
  sqsConsumer.start(stripeEventsQueueName);
  paymentsManager.startFullSyncJob();

  const shutdownHandler = gracefulShutdown(server);
  process.on('SIGINT', shutdownHandler);
  process.on('SIGTERM', shutdownHandler);
  // The 'beforeExit' event is supposed to allow promises and is the place where
  // we are supposed to do graceful async shutdowns. Not sure why the signature
  // doesn't accept a promise...
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  process.on('beforeExit', gracefulShutdownAsync(sqsConsumer));
};

// eslint-disable-next-line @typescript-eslint/no-floating-promises
startApp();
