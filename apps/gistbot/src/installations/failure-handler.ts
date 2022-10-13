import { logger } from '@base/logger';
import { CallbackOptions } from '@slack/oauth';
import { AnalyticsManager } from '../analytics/manager';

export const installationFailureHandler =
  (analyticsManager: AnalyticsManager): CallbackOptions['failure'] =>
  (error, installOptions, req, res) => {
    logger.error(`failed to install slack: ${error.message} ${error.stack}`);

    const params = new URLSearchParams();
    params.set(
      'error',
      `We've failed connecting your slack account to theGist. Please try again.`,
    );
    params.set('from', 'slack_failure');

    analyticsManager.installationFunnel({
      funnelStep: 'failed_install',
      slackTeamId: 'unknown',
      slackUserId: 'unknown',
    });

    res.writeHead(302, {
      Location: `https://www.thegist.ai/slack-failure`,
    });
    res.end();
  };
