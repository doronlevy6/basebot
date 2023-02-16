import { logger } from '@base/logger';
import { Feature } from '../../feature-rate-limiter/limits';
import { FeatureRateLimiter } from '../../feature-rate-limiter/rate-limiter';
import { SlackSlashCommandWrapper } from '../../slack/types';

const ALLOW_MORE_AMOUNT = 5;

export const increaseLimitsCommand = async (
  { body: { user_id, team_id }, ack }: SlackSlashCommandWrapper,
  featureRateLimiter: FeatureRateLimiter,
) => {
  logger.info(
    `${user_id} on team ${team_id} is requesting more for their rate limit`,
  );
  await ack();
  await Promise.all(
    Object.values(Feature).map((f) => {
      // Instead of awaiting internally we are using Promise.all and awaiting on the whole list here.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      featureRateLimiter.allowMore(
        { teamId: team_id, userId: user_id },
        f,
        ALLOW_MORE_AMOUNT,
      );
    }),
  );
};
