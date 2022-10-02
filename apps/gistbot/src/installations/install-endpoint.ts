import { InstallProviderOptions } from '@slack/oauth';
import { AnalyticsManager } from '../analytics/manager';

export const AUTH_VERSION: InstallProviderOptions['authVersion'] = 'v2';

const htmlTemplate = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Install theGist To Your Slack Workspace</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"><script defer>window.location.replace('REPLACE_ME_WITH_URL');</script></head>
  <body>
  </body>
</html>`;

export const installEndpointHtml = (
  analyticsManager: AnalyticsManager,
): InstallProviderOptions['renderHtmlForInstallPath'] => {
  return (url: string): string => {
    analyticsManager.installationFunnel({
      funnelStep: 'begin_install',
      slackTeamId: 'unknown',
      slackUserId: 'unknown',
    });

    return htmlTemplate.replace('REPLACE_ME_WITH_URL', url);
  };
};
