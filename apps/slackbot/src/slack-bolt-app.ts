import { App } from '@slack/bolt';
import { IReporter } from '@base/metrics';
import { logger, BoltWrapper } from '@base/logger';
import { PgInstallationStore } from './installations/installationStore';
import { installationSucccessHandler } from './installations/success-handler';
import { installationFailureHandler } from './installations/failure-handler';
import { ImportController } from './imports/controller';
import { SlackbotApiApi as SlackbotApi } from '@base/oapigen';
import { healthRoute } from './routes/health-route';
import { metricsRoute } from './routes/metrics-route';

export function createApp(
  installationStore: PgInstallationStore,
  metricsReporter: IReporter,
  importController: ImportController,
  baseApi: SlackbotApi,
): App {
  return new App({
    logger: new BoltWrapper(logger),
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    stateSecret: process.env.SLACK_STATE_SECRET,
    customRoutes: [healthRoute(), metricsRoute(metricsReporter)],
    scopes: [
      'chat:write',
      'im:history',
      'team:read',
      'users:read',
      'users:read.email',
      'users.profile:read',
      'commands',
      'channels:history',
    ],
    installationStore: installationStore,
    installerOptions: {
      directInstall: true,
      callbackOptions: {
        successAsync: installationSucccessHandler(importController, baseApi),
        failure: installationFailureHandler,
      },
    },
  });
}
