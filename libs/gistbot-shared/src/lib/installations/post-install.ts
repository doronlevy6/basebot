import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '../analytics/manager';
import { identifyTriggeringUser } from '../slack/utils';

export const postInstallationMessage = async (
  userId: string,
  teamId: string,
  token: string,
  analyticsManager: AnalyticsManager,
) => {
  const client = new WebClient(token);

  // Don't await so that we don't force anything to wait just for the identification.
  // This handles error handling internally and will never cause an exception, so we
  // won't have any unhandled promise rejection errors.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  identifyTriggeringUser(userId, teamId, client, analyticsManager);

  return;
};
