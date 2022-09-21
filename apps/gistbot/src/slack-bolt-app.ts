import { App } from '@slack/bolt';
import { IReporter } from '@base/metrics';
import { logger, BoltWrapper } from '@base/logger';
import { PgInstallationStore } from './installations/installationStore';
import { installationSucccessHandler } from './installations/success-handler';
import { installationFailureHandler } from './installations/failure-handler';
import { healthRoute } from './routes/health-route';
import { metricsRoute } from './routes/metrics-route';

export function createApp(
  installationStore: PgInstallationStore,
  metricsReporter: IReporter,
): App {
  return new App({
    logger: new BoltWrapper(logger),
    signingSecret: process.env.GISTBOT_SLACK_SIGNING_SECRET,
    clientId: process.env.GISTBOT_SLACK_CLIENT_ID,
    clientSecret: process.env.GISTBOT_SLACK_CLIENT_SECRET,
    stateSecret: process.env.GISTBOT_SLACK_STATE_SECRET,
    customRoutes: [healthRoute(), metricsRoute(metricsReporter)],
    scopes: [
      'chat:write',
      'im:history',
      'users:read',
      'users.profile:read',
      'commands',
      'channels:history',
    ],
    installationStore: installationStore,
    installerOptions: {
      directInstall: true,
      callbackOptions: {
        successAsync: installationSucccessHandler,
        failure: installationFailureHandler,
      },
    },
  });
}
