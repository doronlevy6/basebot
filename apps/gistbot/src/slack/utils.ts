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
      error: `${error.stack ? error.stack : error}`,
      userId: userId,
      teamId: teamId,
    });
  }
};

export const splitTextBlocks = (text: string) => {
  const MAX_SLACK_BLOCK_CHARACTERS = 3000;
  if (text.length <= MAX_SLACK_BLOCK_CHARACTERS) {
    return [text];
  }

  const parts: string[] = [];
  const lines = text.split('\n');

  let part = '';
  lines.forEach((line) => {
    if (part.length > 2000) {
      parts.push(`${part}`);
      part = '';
    }
    part = `${part}${line}\n`;
  });
  parts.push(part);

  return parts;
};
