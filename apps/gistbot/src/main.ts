// Force import TSLib because of a bug in NX
import 'tslib';

// Before anything else runs, first we must load the environment that we are running
import { loadEnvs } from '@base/env';
import { environment } from './environments/environment';
loadEnvs(environment, ['configs', 'secrets']);

import {
  CustomerIdentifier,
  PgCustomerStore,
  RedisCustomerIdentifierLock,
  SubscriptionManager,
} from '@base/customer-identifier';
import { EmailSender } from '@base/emailer';
import { AnalyticsManager, PgInstallationStore } from '@base/gistbot-shared';
import { BoltWrapper, logger } from '@base/logger';
import { PrometheusReporter, slackBoltMetricsMiddleware } from '@base/metrics';
import { SqsConsumer } from '@base/pubsub';
import { readyChecker, RedisConfig } from '@base/utils';
import { App } from '@slack/bolt';
import { EventEmitter } from 'events';
import { Server } from 'http';
import { BotsManager } from './bots-integrations/bots-manager';
import { GithubBot } from './bots-integrations/bots/github.bot';
import { FeatureRateLimiter } from './feature-rate-limiter/rate-limiter';
import { RedisRateLimiter } from './feature-rate-limiter/rate-limiter-store';
import { AppHomeManager } from './home/app-home-manager';
import { EmailDigestManager } from './home/email-manager';
import { HomeDataStore } from './home/home-data-store';
import { NewUserTriggersManager } from './new-user-triggers/manager';
import { RedisTriggerLock } from './new-user-triggers/trigger-lock';
import { PgTriggerLock } from './new-user-triggers/trigger-lock-persistent';
import { OnboardingManager } from './onboarding/manager';
import { UserOnboardedNotifier } from './onboarding/notifier';
import { RedisOnboardingLock } from './onboarding/onboarding-lock';
import { OnboardingNudgeJob } from './onboarding/onboarding-nudge-job';
import { RedisOnboardingNudgeLock } from './onboarding/onboarding-nudge-lock';
import { PgOnboardingStore } from './onboarding/onboardingStore';
import { PgOrgSettingsStore } from './orgsettings/store';
import { registerBoltAppRouter } from './routes/router';
import { createServer } from './server';
import { createApp } from './slack-bolt-app';
import { ScheduledMessageSender } from './slack/scheduled-messages/manager';
import AwsSQSReceiver from './slack/sqs-receiver';
import { ChannelSummaryStore } from './summaries/channel-summary-store';
import { ChannelSummarizer } from './summaries/channel/channel-summarizer';
import { MultiChannelSummarizer } from './summaries/channel/multi-channel-summarizer';
import { MessagesSummarizer } from './summaries/messages/messages-summarizer';
import { ChannelModelTranslator } from './summaries/models/channel-model-translator';
import { ChannelSummaryModel } from './summaries/models/channel-summary.model';
import { MessagesSummaryModel } from './summaries/models/messages-summary.model';
import { InternalSessionFetcher } from './summaries/session-data/internal-fetcher';
import { PgSessionDataStore } from './summaries/session-data/session-data-store';
import { SummaryStore } from './summaries/summary-store';
import { ThreadSummarizer } from './summaries/thread/thread-summarizer';
import { SchedulerSettingsManager } from './summary-scheduler/scheduler-manager';
import { RedisSchedulerSettingsLock } from './summary-scheduler/scheduler-settings-lock';
import { PgSchedulerSettingsStore } from './summary-scheduler/scheduler-store';
import { SummarySchedulerJob } from './summary-scheduler/summary-scheduler-job';
import { UninstallsNotifier } from './uninstall/notifier';
import { UserFeedbackManager } from './user-feedback/manager';
import { SlackDataStore } from './utils/slack-data-store';

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

const gracefulShutdownAsync = (
  app: App,
  sqsConsumer: SqsConsumer,
  analyticsManager: AnalyticsManager,
) => {
  return async () => {
    await Promise.all([
      sqsConsumer.stop(),
      app.stop(),
      analyticsManager.close(),
    ]);
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
  const pgSchedulerSettingsStore = new PgSchedulerSettingsStore(pgConfig);
  const redisConfig: RedisConfig = {
    host: process.env.REDIS_HOST || '',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    cluster: process.env.REDIS_CLUSTER === 'true',
  };
  const pgNewUsersTriggersLock = new PgTriggerLock(pgConfig);
  const pgSessionDataStore = new PgSessionDataStore(pgConfig);

  const emailSender = new EmailSender(
    process.env.SENDGRID_API_KEY || '',
    'welcome@mail.thegist.ai',
  );

  const redisRateLimiter = new RedisRateLimiter(redisConfig, env);
  const customerStore = new PgCustomerStore(pgConfig);
  const customerIdentifierLock = new RedisCustomerIdentifierLock(
    redisConfig,
    env,
  );
  const customerIdentifier = new CustomerIdentifier(
    customerStore,
    customerIdentifierLock,
    emailSender,
    process.env.SLACK_REDIRECT_URL ||
      'https://slack.com/app_redirect?app=A043A1099D1',
  );

  const stripeApiKey = process.env.STRIPE_API_KEY;
  if (!stripeApiKey) {
    throw new Error('stripe api key is missing in secrets');
  }
  const subscriptionManager = new SubscriptionManager(
    customerStore,
    stripeApiKey,
  );
  const featureRateLimiter = new FeatureRateLimiter(
    redisRateLimiter,
    subscriptionManager,
  );

  const enableV3Model = process.env.USE_MODEL_V3 === 'true';
  const apiGwBaseUrl = process.env.API_GW_BASE_URL;
  const standardWorkflowArn = process.env.STEP_FUNCTION_ARN;
  const expressWorkflowArn = process.env.EXPRESS_STEP_FUNCTION_ARN;
  if (
    enableV3Model &&
    (!apiGwBaseUrl || !standardWorkflowArn || !expressWorkflowArn)
  ) {
    throw new Error(
      'configuration for v3 model is missing when v3 model is enabled',
    );
  }

  const messagesSummaryModel = new MessagesSummaryModel(
    apiGwBaseUrl || '', // Shouldn't be undefined if enable is true (which is where it is used)
    standardWorkflowArn || '', // Shouldn't be undefined if enable is true (which is where it is used)
    expressWorkflowArn || '', // Shouldn't be undefined if enable is true (which is where it is used)
  );
  const channelSummaryModel = new ChannelSummaryModel();

  const onboardingLock = new RedisOnboardingLock(redisConfig, env);
  const summarySchedulerLock = new RedisSchedulerSettingsLock(redisConfig, env);
  const summaryStore = new SummaryStore(redisConfig, env);
  const channelSummaryStore = new ChannelSummaryStore(redisConfig, env);
  const slackDataStore = new SlackDataStore(redisConfig, env);
  const newUserTriggersLock = new RedisTriggerLock(redisConfig, env);
  const onboardingNudgeLock = new RedisOnboardingNudgeLock(redisConfig, env);
  const analyticsManager = new AnalyticsManager();
  const botsManager = new BotsManager(new GithubBot());
  const channelModelTranslator = new ChannelModelTranslator();

  const messagesSummarizer = new MessagesSummarizer(
    messagesSummaryModel,
    channelSummaryModel,
    channelModelTranslator,
    pgSessionDataStore,
    botsManager,
    slackDataStore,
    enableV3Model,
  );

  const threadSummarizer = new ThreadSummarizer(
    messagesSummarizer,
    analyticsManager,
    summaryStore,
    pgSessionDataStore,
    metricsReporter,
    featureRateLimiter,
  );

  const channelSummarizer = new ChannelSummarizer(
    messagesSummarizer,
    analyticsManager,
    summaryStore,
    slackDataStore,
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
  ready = await pgSchedulerSettingsStore.isReady();
  if (!ready) {
    throw new Error('PgSchedulerSettingsStore is not ready');
  }
  ready = await analyticsManager.isReady();
  if (!ready) {
    throw new Error('AnalyticsManager is not ready');
  }
  ready = await onboardingLock.isReady();
  if (!ready) {
    throw new Error('OnboardingLock is not ready');
  }
  ready = await summarySchedulerLock.isReady();
  if (!ready) {
    throw new Error('SummarySchedulerLock is not ready');
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

  const registrationBotToken = process.env.SLACK_REGISTRATIONS_BOT_TOKEN;
  if (!registrationBotToken) {
    throw new Error('no bot token given for internal Slack Client');
  }

  const userOnboardingNotifier = new UserOnboardedNotifier(
    env,
    registrationBotToken,
    env !== 'local',
    slackDataStore,
  );
  const uninstallNotifier = new UninstallsNotifier(
    env,
    registrationBotToken,
    env !== 'local',
    slackDataStore,
  );

  const userFeedbackManager = new UserFeedbackManager(
    analyticsManager,
    env,
    registrationBotToken, // Just use the auth0 notifier token for now, doesn't really matter at all
    slackDataStore,
  );

  const onboardingManager = new OnboardingManager(
    pgOnboardingStore,
    onboardingLock,
    analyticsManager,
    metricsReporter,
    userOnboardingNotifier,
    slackDataStore,
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

  const multiChannelSummarizer = new MultiChannelSummarizer(
    messagesSummarizer,
    analyticsManager,
    channelSummarizer,
    slackDataStore,
    channelSummaryStore,
  );

  const summarySchedulerMgr = new SchedulerSettingsManager(
    pgSchedulerSettingsStore,
    analyticsManager,
    slackDataStore,
  );

  const allQueueCfg = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    cluster: process.env.REDIS_CLUSTER === 'true',
    prefix: `{gistbot:queues:${process.env.ENV || 'local'}}`,
  };

  const mailbotQueueCfg = {
    ...allQueueCfg,
    prefix: `{mailbot:queues:${process.env.ENV || 'local'}}`,
  };

  const scheduledMessageSender = new ScheduledMessageSender(
    allQueueCfg,
    pgStore,
    analyticsManager,
  );

  const homeDataStore = new HomeDataStore(pgConfig);
  const eventsEmitter = new EventEmitter();
  const emailDigestManager = new EmailDigestManager(
    mailbotQueueCfg,
    pgStore,
    analyticsManager,
    slackDataStore,
    homeDataStore,
    eventsEmitter,
  );

  const summarySchedulerJob = new SummarySchedulerJob(
    summarySchedulerMgr,
    summarySchedulerLock,
    multiChannelSummarizer,
    pgStore,
    analyticsManager,
    subscriptionManager,
    scheduledMessageSender,
    onboardingManager,
  );

  const orgSettingsStore = new PgOrgSettingsStore(pgConfig);

  // readyChecker is a small util for all things that implement `isReady`. It will
  // check to see if all of these are ready and throw an error if one isn't.
  await readyChecker(
    customerStore,
    customerIdentifierLock,
    orgSettingsStore,
    scheduledMessageSender,
    emailDigestManager,
    slackDataStore,
    homeDataStore,
  );

  const sqsRegion = process.env.SQS_REGION;
  const sqsBaseUrl = process.env.SQS_BASE_URL;
  const sqsAccountId = process.env.SQS_ACCOUNT_ID;
  const slackEventsQueueName = process.env.SLACK_SQS_QUEUE_NAME;
  if (!sqsRegion || !sqsBaseUrl || !sqsAccountId || !slackEventsQueueName) {
    throw new Error('missing sqs details in configs');
  }

  const sqsConfig = {
    baseUrl: sqsBaseUrl,
    region: sqsRegion,
    accountId: sqsAccountId,
  };

  const sqsReceiver = new AwsSQSReceiver({
    sqsConfig: sqsConfig,
    sqsQueueName: slackEventsQueueName,
    logger: new BoltWrapper(logger),
  });

  const slackApp = createApp(sqsReceiver, pgStore);
  slackApp.use(slackBoltMetricsMiddleware(metricsReporter));

  new AppHomeManager(
    pgStore,
    pgSchedulerSettingsStore,
    homeDataStore,
    eventsEmitter,
  );

  registerBoltAppRouter(
    slackApp,
    pgStore,
    analyticsManager,
    metricsReporter,
    threadSummarizer,
    channelSummarizer,
    onboardingManager,
    summaryStore,
    slackDataStore,
    newUserTriggersManager,
    userFeedbackManager,
    pgSessionDataStore,
    featureRateLimiter,
    multiChannelSummarizer,
    summarySchedulerMgr,
    customerIdentifier,
    orgSettingsStore,
    uninstallNotifier,
    eventsEmitter,
  );

  // Bolt's Receiver implements a start function that returns a generic value,
  // but the App start function is hardcoded to return an Http Server value.
  // Because we are forcing this to be our implementation of an SqsReceiver then we
  // force the type to be an SqsReceiver type.
  const sqsConsumer = (await slackApp.start()) as unknown as SqsConsumer;

  const app = createServer(metricsReporter, internalSessionFetcher, baseApiKey);
  const port = process.env['PORT'] || 3000;
  const server = app.listen(port, () => {
    logger.debug(`running ${env} server on port ${port}`);
  });
  server.on('error', console.error);

  onboardingNudgeJob.start();
  summarySchedulerJob.start();

  const shutdownHandler = gracefulShutdown(server);
  process.on('SIGINT', shutdownHandler);
  process.on('SIGTERM', shutdownHandler);
  process.on(
    'beforeExit',
    // The 'beforeExit' event is supposed to allow promises and is the place where
    // we are supposed to do graceful async shutdowns. Not sure why the signature
    // doesn't accept a promise...
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    gracefulShutdownAsync(slackApp, sqsConsumer, analyticsManager),
  );
};

// eslint-disable-next-line @typescript-eslint/no-floating-promises
startApp();
