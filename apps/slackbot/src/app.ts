import { App } from '@slack/bolt';
import { httpMetricsEndpoint, IReporter } from '@base/metrics';
import { logger, BoltWrapper } from '@base/logger';
import { PgInstallationStore } from './installations/installationStore';

export function createApp(
  installationStore: PgInstallationStore,
  metricsReporter: IReporter,
): App {
  return new App({
    logger: new BoltWrapper(logger),
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    stateSecret: process.env.SLACK_STATE_SECRET,
    customRoutes: [
      {
        path: '/health',
        method: ['GET'],
        handler: async (_, res) => {
          res.writeHead(200);
          const healthRes = {
            status: 'ok',
            info: {
              serviceInfo: {
                status: 'up',
                env: process.env.ENV,
                version: process.env.VERSION,
                tag: process.env.TAG,
              },
            },
            error: {},
            details: {
              serviceInfo: {
                status: 'up',
                env: process.env.ENV,
                version: process.env.VERSION,
                tag: process.env.TAG,
              },
            },
          };
          res.end(JSON.stringify(healthRes));
        },
      },
      {
        path: '/metrics',
        method: ['GET'],
        handler: httpMetricsEndpoint(metricsReporter),
      },
    ],
    scopes: [
      'chat:write',
      'im:history',
      'team:read',
      'users:read',
      'users:read.email',
      'users.profile:read',
    ],
    installationStore: installationStore,
    installerOptions: {
      directInstall: true,
    },
  });
}
