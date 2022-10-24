import { InstallProviderOptions, InstallPathOptions } from '@slack/oauth';
import { AnalyticsManager } from '../analytics/manager';

export const AUTH_VERSION: InstallProviderOptions['authVersion'] = 'v2';

export const installEndpoint = (
  analyticsManager: AnalyticsManager,
): InstallPathOptions['beforeRedirection'] => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return async (req, res, options): Promise<boolean> => {
    // The request doesn't contain the full url (only the path) so in order to successfully parse the url
    // we use a simple localhost base for the URL itself.
    const reqUrl = new URL(req.url || '/slack/install', 'http://localhost');

    const extras = {};
    reqUrl.searchParams.forEach((value, key) => {
      extras[key] = value;
    });
    extras['userAgent'] = req.headers['user-agent'] || 'unknown';
    extras['referrer'] = req.headers.referer || 'unknown';
    extras['ip'] = req.headers['x-forwarded-for'] || 'unknown';

    if (options) {
      options.metadata = JSON.stringify(extras);
    }

    analyticsManager.installationFunnel({
      funnelStep: 'begin_install',
      slackTeamId: 'unknown',
      slackUserId: 'unknown',
      extraParams: {
        ...extras,
      },
    });

    return true;
  };
};
