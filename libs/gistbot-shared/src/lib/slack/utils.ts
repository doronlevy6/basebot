import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '../analytics/manager';

export const identifyTriggeringUser = async (
  userId: string,
  teamId: string,
  client: WebClient,
  analyticsManager: AnalyticsManager,
) => {
  try {
    const { error, ok, profile } = await client.users.profile.get({
      user: userId,
    });
    if (error || !ok) {
      throw new Error(`Failed to fetch user profile ${error}`);
    }

    if (!profile) {
      throw new Error(`Failed to fetch user profile profile not found`);
    }

    analyticsManager.identifyUser({
      slackUserId: userId,
      slackTeamId: teamId,
      username: profile.display_name,
      realName: profile.real_name,
      avatarUrl: profile.image_512,
      email: profile.email,
    });
  } catch (error) {
    logger.error({
      msg: `failed to identify triggering user with error`,
      error: `${(error as Error).stack ? (error as Error).stack : error}`,
      userId: userId,
      teamId: teamId,
    });
  }
};
