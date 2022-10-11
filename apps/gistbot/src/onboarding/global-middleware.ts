import {
  AnyMiddlewareArgs,
  Middleware,
  RespondFn,
  SlackActionMiddlewareArgs,
  SlackCommandMiddlewareArgs,
  SlackShortcutMiddlewareArgs,
  SlackViewMiddlewareArgs,
} from '@slack/bolt';
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
    const { logger, next, client, context } = args;
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
        context.botUserId,
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

function isActionArgs(
  args: AnyMiddlewareArgs,
): args is SlackActionMiddlewareArgs {
  return (args as SlackActionMiddlewareArgs).action !== undefined;
}

function isCommandArgs(
  args: AnyMiddlewareArgs,
): args is SlackCommandMiddlewareArgs {
  return (args as SlackCommandMiddlewareArgs).command !== undefined;
}

function isViewArgs(args: AnyMiddlewareArgs): args is SlackViewMiddlewareArgs {
  return (args as SlackViewMiddlewareArgs).view !== undefined;
}

function isShortcutArgs(
  args: AnyMiddlewareArgs,
): args is SlackShortcutMiddlewareArgs {
  return (args as SlackShortcutMiddlewareArgs).shortcut !== undefined;
}
