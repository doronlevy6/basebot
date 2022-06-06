import { App } from '@slack/bolt';
import { DefaultApi } from '@base/oapigen';
import { httpMetricsEndpoint, IReporter } from '@base/metrics';
import { logger, BoltWrapper } from '@base/logger';

// TODO: database
export function createApp(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: any,
  backendApi: DefaultApi,
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
        path: '/base/health',
        method: ['GET'],
        handler: async (_, res) => {
          try {
            const apires = await backendApi.healthControllerCheck();
            res.writeHead(200);
            res.end(JSON.stringify(apires.data));
          } catch (error) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: error }));
          }
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
      'team:read',
      'users:read',
      'users:read.email',
      'users.profile:read',
    ],
    installationStore: {
      storeInstallation: async (installation) => {
        if (
          installation.isEnterpriseInstall &&
          installation.enterprise !== undefined
        ) {
          return await database.set(installation.enterprise.id, installation);
        }
        if (installation.team !== undefined) {
          return await database.set(installation.team.id, installation);
        }
        throw new Error('Failed saving installation data to installationStore');
      },
      fetchInstallation: async (installQuery) => {
        if (
          installQuery.isEnterpriseInstall &&
          installQuery.enterpriseId !== undefined
        ) {
          return await database.get(installQuery.enterpriseId);
        }
        if (installQuery.teamId !== undefined) {
          return await database.get(installQuery.teamId);
        }
        throw new Error('Failed fetching installation');
      },
      deleteInstallation: async (installQuery) => {
        if (
          installQuery.isEnterpriseInstall &&
          installQuery.enterpriseId !== undefined
        ) {
          return await database.delete(installQuery.enterpriseId);
        }
        if (installQuery.teamId !== undefined) {
          return await database.delete(installQuery.teamId);
        }
        throw new Error('Failed to delete installation');
      },
    },
  });
}
