import { App } from '@slack/bolt';
import { IReporter } from '@base/metrics';
import { logger, BoltWrapper } from '@base/logger';
import {
  AnalyticsManager,
  AUTH_VERSION,
  installationSucccessHandler,
  installationFailureHandler,
  installEndpoint,
  PgInstallationStore,
} from '@base/gistbot-shared';
import { healthRoute } from './routes/health-route';
import { metricsRoute } from './routes/metrics-route';

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
      'channels:read',
      'groups:read',
    ],
    installationStore: installationStore,
    installerOptions: {
      directInstall: true,
      installPathOptions: {
        beforeRedirection: installEndpoint(analyticsManager),
      },
      stateCookieExpirationSeconds: 86400, // 1 day in seconds
      stateVerification: false, // Must be set to false to allow Org-level apps to be installed (which we need to allow)
      authVersion: AUTH_VERSION,
      callbackOptions: {
        successAsync: installationSucccessHandler(analyticsManager),
        failure: installationFailureHandler(analyticsManager),
      },
    },
    socketMode: false,
    // developerMode enables a huge amount of debug logs from within bolt.
    // Good for debugging, but we can remove it for now.
    developerMode: false,
  });
}
