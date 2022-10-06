// Force import TSLib because of a bug in NX
import 'tslib';

// Before anything else runs, first we must load the environment that we are running
import { loadEnvs } from '@base/env';
import { environment } from './environments/environment';
loadEnvs(environment, ['configs', 'secrets']);

import { logger } from '@base/logger';
import { PrometheusReporter, slackBoltMetricsMiddleware } from '@base/metrics';
import { Server } from 'http';
import { PgInstallationStore } from './installations/installationStore';
import { createApp } from './slack-bolt-app';
import { registerBoltAppRouter } from './routes/router';
import { AnalyticsManager } from './analytics/manager';
import { ThreadSummaryModel } from './summaries/models/thread-summary.model';
import { ChannelSummaryModel } from './summaries/models/channel-summary.model';
import { PgOnboardingStore } from './onboarding/onboardingStore';
import { userOnboardingMiddleware } from './onboarding/global-middleware';
import { ChannelSummarizer } from './summaries/channel/channel-summarizer';

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

const gracefulShutdownAsync = (analyticsManager: AnalyticsManager) => {
  return async () => {
    await Promise.all([analyticsManager.close()]);
  };
};

const startApp = async () => {
  const metricsReporter = new PrometheusReporter();

  const pgConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || '',
    synchronize: ['development', 'local'].includes(
      process.env.ENV ||
        'local' /* We are defaulting to local env to be explicit */,
    ),
  };
  const pgStore = new PgInstallationStore(metricsReporter, pgConfig);
  const pgOnboardingStore = new PgOnboardingStore(metricsReporter, pgConfig);

  const analyticsManager = new AnalyticsManager();
  const threadSummaryModel = new ThreadSummaryModel();
  const channelSummaryModel = new ChannelSummaryModel();
  const channelSummarizer = new ChannelSummarizer(
    channelSummaryModel,
    analyticsManager,
  );

  let ready = await pgStore.isReady();
  if (!ready) {
    throw new Error('PgStore is not ready');
  }
  ready = await pgOnboardingStore.isReady();
  if (!ready) {
    throw new Error('PgOnboardingStore is not ready');
  }
  ready = await analyticsManager.isReady();
  if (!ready) {
    throw new Error('AnalyticsManager is not ready');
  }

  const slackApp = createApp(pgStore, metricsReporter, analyticsManager);
  slackApp.use(slackBoltMetricsMiddleware(metricsReporter));
  slackApp.use(userOnboardingMiddleware(pgOnboardingStore, analyticsManager));

  registerBoltAppRouter(
    slackApp,
    pgStore,
    analyticsManager,
    threadSummaryModel,
    channelSummarizer,
    pgOnboardingStore,
  );

  const port = process.env['PORT'] || 3000;
  const server = await slackApp.start(port);
  server.on('error', console.error);

  const shutdownHandler = gracefulShutdown(server);
  process.on('SIGINT', shutdownHandler);
  process.on('SIGTERM', shutdownHandler);
  process.on('beforeExit', gracefulShutdownAsync(analyticsManager));
};

startApp();
