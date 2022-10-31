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
import { ChannelSummarizer } from './summaries/channel/channel-summarizer';
import { ThreadSummarizer } from './summaries/thread/thread-summarizer';
import { UserOnboardedNotifier } from './onboarding/notifier';
import { RedisOnboardingLock } from './onboarding/onboarding-lock';
import { RedisConfig } from './utils/redis-util';
import { SummaryStore } from './summaries/summary-store';
import { OnboardingManager } from './onboarding/manager';
import { NewUserTriggersManager } from './new-user-triggers/manager';
import { RedisTriggerLock } from './new-user-triggers/trigger-lock';
import { PgTriggerLock } from './new-user-triggers/trigger-lock-persistent';
import { UserFeedbackManager } from './user-feedback/manager';
import { EmailSender } from './email/email-sender.util';
import { OnboardingNudgeJob } from './onboarding/onboarding-nudge-job';
import { RedisOnboardingNudgeLock } from './onboarding/onboarding-nudge-lock';
import { PgSessionDataStore } from './summaries/session-data/session-data-store';
import { RedisRateLimiter } from './feature-rate-limiter/rate-limiter-store';
import { FeatureRateLimiter } from './feature-rate-limiter/rate-limiter';
import { InternalSessionFetcher } from './summaries/session-data/internal-fetcher';
import { PgTiersStore } from './feature-rate-limiter/tiers-store';

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

  const env =
    process.env.ENV ||
    'local'; /* We are defaulting to local env to be explicit */
  const pgConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || '',
    synchronize: ['development', 'local'].includes(env),
  };
  const pgStore = new PgInstallationStore(metricsReporter, pgConfig);
  const pgOnboardingStore = new PgOnboardingStore(metricsReporter, pgConfig);
  const redisConfig: RedisConfig = {
    host: process.env.REDIS_HOST || '',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    cluster: process.env.REDIS_CLUSTER === 'true',
  };
  const pgNewUsersTriggersLock = new PgTriggerLock(pgConfig);
  const pgSessionDataStore = new PgSessionDataStore(pgConfig);

  const redisRateLimiter = new RedisRateLimiter(redisConfig, env);
  const pgTiersStore = new PgTiersStore(pgConfig);
  const featureRateLimiter = new FeatureRateLimiter(
    redisRateLimiter,
    pgTiersStore,
  );

  const onboardingLock = new RedisOnboardingLock(redisConfig, env);
  const summaryStore = new SummaryStore(redisConfig, env);
  const newUserTriggersLock = new RedisTriggerLock(redisConfig, env);
  const onboardingNudgeLock = new RedisOnboardingNudgeLock(redisConfig, env);
  const analyticsManager = new AnalyticsManager();
  const threadSummaryModel = new ThreadSummaryModel();
  const threadSummarizer = new ThreadSummarizer(
    threadSummaryModel,
    analyticsManager,
    summaryStore,
    pgSessionDataStore,
    metricsReporter,
    featureRateLimiter,
  );

  const channelSummaryModel = new ChannelSummaryModel();
  const channelSummarizer = new ChannelSummarizer(
    channelSummaryModel,
    analyticsManager,
    summaryStore,
    pgSessionDataStore,
    metricsReporter,
    featureRateLimiter,
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
  ready = await onboardingLock.isReady();
  if (!ready) {
    throw new Error('OnboardingLock is not ready');
  }
  ready = await summaryStore.isReady();
  if (!ready) {
    throw new Error('SummaryStore is not ready');
  }
  ready = await pgNewUsersTriggersLock.isReady();
  if (!ready) {
    throw new Error('PgNewUsersTriggersLock is not ready');
  }
  ready = await newUserTriggersLock.isReady();
  if (!ready) {
    throw new Error('NewUserTriggersLock is not ready');
  }
  ready = await pgSessionDataStore.isReady();
  if (!ready) {
    throw new Error('PgSessionDataStore is not ready');
  }
  ready = await redisRateLimiter.isReady();
  if (!ready) {
    throw new Error('RedisRateLimiter is not ready');
  }
  ready = await pgTiersStore.isReady();
  if (!ready) {
    throw new Error('PgTiersStore is not ready');
  }

  const registrationBotToken = process.env.SLACK_REGISTRATIONS_BOT_TOKEN;
  if (!registrationBotToken) {
    throw new Error('no bot token given for internal Slack Client');
  }

  const userOnboardingNotifier = new UserOnboardedNotifier(
    env,
    registrationBotToken,
    env !== 'local',
  );

  const userFeedbackManager = new UserFeedbackManager(
    analyticsManager,
    env,
    registrationBotToken, // Just use the auth0 notifier token for now, doesn't really matter at all
  );
  const emailSender = new EmailSender();
  const onboardingManager = new OnboardingManager(
    pgOnboardingStore,
    onboardingLock,
    analyticsManager,
    metricsReporter,
    userOnboardingNotifier,
    emailSender,
    pgStore,
  );
  const onboardingNudgeJob = new OnboardingNudgeJob(
    onboardingManager,
    onboardingNudgeLock,
  );

  const newUserTriggersManager = new NewUserTriggersManager(
    onboardingManager,
    newUserTriggersLock,
    pgNewUsersTriggersLock,
  );

  const baseApiKey = process.env.BASE_API_KEY;
  if (!baseApiKey) {
    throw new Error('no base api key given for internal session fetcher');
  }

  const internalSessionFetcher = new InternalSessionFetcher(
    pgSessionDataStore,
    pgStore,
  );

  const slackApp = createApp(
    pgStore,
    metricsReporter,
    analyticsManager,
    internalSessionFetcher,
    baseApiKey,
  );
  slackApp.use(slackBoltMetricsMiddleware(metricsReporter));

  registerBoltAppRouter(
    slackApp,
    pgStore,
    analyticsManager,
    metricsReporter,
    threadSummarizer,
    channelSummarizer,
    onboardingManager,
    summaryStore,
    newUserTriggersManager,
    userFeedbackManager,
    pgSessionDataStore,
    featureRateLimiter,
  );

  const port = process.env['PORT'] || 3000;
  const server = await slackApp.start(port);
  server.on('error', console.error);

  onboardingNudgeJob.start();

  const shutdownHandler = gracefulShutdown(server);
  process.on('SIGINT', shutdownHandler);
  process.on('SIGTERM', shutdownHandler);
  process.on('beforeExit', gracefulShutdownAsync(analyticsManager));
};

startApp();
