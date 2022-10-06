import { App } from '@slack/bolt';
import { IReporter } from '@base/metrics';
import { logger, BoltWrapper } from '@base/logger';
import { PgInstallationStore } from './installations/installationStore';
import { installationSucccessHandler } from './installations/success-handler';
import { installationFailureHandler } from './installations/failure-handler';
import { healthRoute } from './routes/health-route';
import { metricsRoute } from './routes/metrics-route';
import { AnalyticsManager } from './analytics/manager';
import {
  AUTH_VERSION,
  installEndpoint,
} from './installations/install-endpoint';

export function createApp(
  installationStore: PgInstallationStore,
  metricsReporter: IReporter,
  analyticsManager: AnalyticsManager,
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
      'channels:join',
      'usergroups:read',
      'reactions:read',
      'groups:history',
    ],
    installationStore: installationStore,
    installerOptions: {
      directInstall: true,
      installPathOptions: {
        beforeRedirection: installEndpoint(analyticsManager),
      },
      authVersion: AUTH_VERSION,
      callbackOptions: {
        successAsync: installationSucccessHandler(analyticsManager),
        failure: installationFailureHandler(analyticsManager),
      },
    },
  });
}
