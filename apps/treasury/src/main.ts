// Force import TSLib because of a bug in NX
import 'tslib';

// Before anything else runs, first we must load the environment that we are running
import { loadEnvs } from '@base/env';
import { environment } from './environments/environment';
loadEnvs(environment, ['configs', 'secrets']);

import { logger } from '@base/logger';
import { PrometheusReporter } from '@base/metrics';
import { Server } from 'http';
import { createServer } from './server';
import { PaymentsManager } from './payments/manager';
import { SqsPublisher } from './pubsub/sqs-publisher';
import { SqsConsumer } from './pubsub/sqs-consumer';
import { RedisFullSyncJobLock } from './payments/joblock';
import { RedisConfig } from './utils/redis-util';

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
  const fullSyncJobLock = new RedisFullSyncJobLock(redisConfig, env);

  const paymentsManager = new PaymentsManager({
    stripeApiKey,
    stripeWebhookSecret,
    stripeEventsQueue: stripeEventsQueueName,
    publisher: sqsPublisher,
    lock: fullSyncJobLock,
  });

  const sqsConsumer = new SqsConsumer(sqsConfig, (msg) => {
    return paymentsManager.consume(msg);
  });

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
  process.on('beforeExit', gracefulShutdownAsync(sqsConsumer));
};

startApp();
