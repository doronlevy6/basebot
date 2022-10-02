import { CallbackOptions } from '@slack/oauth';
import { AnalyticsManager } from '../analytics/manager';
import { postInstallationMessage } from './post-install';

export const installationSucccessHandler = (
  analyticsManager: AnalyticsManager,
): CallbackOptions['successAsync'] => {
  return async (installation, installOptions, req, res) => {
    const redirectUrl = process.env.SLACK_REDIRECT_URL as string;

    await postInstallationMessage(
      installation.user.id,
      installation.team?.id || 'unknown',
      installation.bot?.token || '',
      analyticsManager,
    );

    analyticsManager.installationFunnel({
      funnelStep: 'successful_install',
      slackTeamId: installation.team?.id || 'unknown',
      slackUserId: installation.user.id,
      extraParams: {
        isEnterprise: installation.isEnterpriseInstall || false,
      },
    });

    if (installation.isEnterpriseInstall) {
      const redirectUrl = `https://app.slack.com/manage/${installation.enterprise?.id}/integrations/profile/${installation.appId}/workspaces/add`;
      res.writeHead(302, {
        Location: redirectUrl,
      });
      res.end();
      return;
    }

    res.writeHead(302, {
      Location: redirectUrl,
    });
    res.end();
  };
};
