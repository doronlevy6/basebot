import { AnyMiddlewareArgs, Middleware, RespondFn } from '@slack/bolt';
import {
  isActionArgs,
  isCommandArgs,
  isViewArgs,
  isShortcutArgs,
} from '../slack/middleware-utils';
import { OnboardingManager } from './manager';

interface slackIds {
  type: 'user-interaction';
  teamId: string;
  userId: string;
  respond: RespondFn;
}

export const userOnboardingMiddleware =
  (onboardingManager: OnboardingManager): Middleware<AnyMiddlewareArgs> =>
  async (args) => {
    const { logger, next, client } = args;
    const vals = getUserIdAndTeamId(args);

    if (!vals) {
      await next();
      return;
    }

    try {
      await onboardingManager.onboardUser(
        vals.teamId,
        vals.userId,
        client,
        'global_middleware',
      );
    } catch (error) {
      logger.error(
        `error checking if the user was onboarded: ${error} - ${error.stack}`,
      );
    }

    await next();
  };

function getUserIdAndTeamId(args: AnyMiddlewareArgs): slackIds | undefined {
  if (isActionArgs(args)) {
    return {
      type: 'user-interaction',
      teamId: args.body.team?.id || 'unknown',
      userId: args.body.user.id,
      respond: args.respond,
    };
  }

  if (isCommandArgs(args)) {
    return {
      type: 'user-interaction',
      teamId: args.body.team_id || 'unknown',
      userId: args.body.user_id,
      respond: args.respond,
    };
  }

  if (isViewArgs(args)) {
    return {
      type: 'user-interaction',
      teamId: args.body.team?.id || 'unknown',
      userId: args.body.user.id,
      respond: args.respond,
    };
  }

  if (isShortcutArgs(args)) {
    return {
      type: 'user-interaction',
      teamId: args.body.team?.id || 'unknown',
      userId: args.body.user.id,
      respond: args.respond,
    };
  }
}
