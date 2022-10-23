import { InstallProviderOptions, InstallPathOptions } from '@slack/oauth';
import { AnalyticsManager } from '../analytics/manager';

export const AUTH_VERSION: InstallProviderOptions['authVersion'] = 'v2';

export const installEndpoint = (
  analyticsManager: AnalyticsManager,
): InstallPathOptions['beforeRedirection'] => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return async (req, res, options): Promise<boolean> => {
    analyticsManager.installationFunnel({
      funnelStep: 'begin_install',
      slackTeamId: 'unknown',
      slackUserId: 'unknown',
      extraParams: {
        useragent: req.headers['user-agent'] || 'unknown',
        referer: req.headers.referer || 'unknown',
      },
    });

    return true;
  };
};
