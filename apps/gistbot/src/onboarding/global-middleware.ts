import {
  AnyMiddlewareArgs,
  Middleware,
  RespondFn,
  SlackActionMiddlewareArgs,
  SlackCommandMiddlewareArgs,
  SlackShortcutMiddlewareArgs,
  SlackViewMiddlewareArgs,
} from '@slack/bolt';
import { AnalyticsManager } from '../analytics/manager';
import { UserLink } from '../slack/components/user-link';
import { Welcome } from '../slack/components/welcome';
import { OnboardingStore } from './onboardingStore';

interface slackIds {
  teamId: string;
  userId: string;
  respond: RespondFn;
}

export const userOnboardingMiddleware =
  (
    onboardingStore: OnboardingStore,
    analyticsManager: AnalyticsManager,
  ): Middleware<AnyMiddlewareArgs> =>
  async (args) => {
    const { logger, next } = args;
    const vals = getUserIdAndTeamId(args);

    if (!vals) {
      await next();
      return;
    }

    try {
      const wasOnboarded = await onboardingStore.wasUserOnboarded(
        vals.teamId,
        vals.userId,
      );

      if (!wasOnboarded) {
        await vals.respond({
          response_type: 'ephemeral',
          text: `Hey ${UserLink(vals.userId)} :wave: I'm theGist!`,
          blocks: Welcome(vals.userId),
        });

        analyticsManager.messageSentToUserDM({
          type: 'onboarding_message',
          slackTeamId: vals.teamId,
          slackUserId: vals.userId,
          properties: {
            ephemeral: true,
          },
        });

        await onboardingStore.userOnboarded(vals.teamId, vals.userId);
      }
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
      teamId: args.body.team?.id || 'unknown',
      userId: args.body.user.id,
      respond: args.respond,
    };
  }

  if (isCommandArgs(args)) {
    return {
      teamId: args.body.team_id || 'unknown',
      userId: args.body.user_id,
      respond: args.respond,
    };
  }

  if (isViewArgs(args)) {
    return {
      teamId: args.body.team?.id || 'unknown',
      userId: args.body.user.id,
      respond: args.respond,
    };
  }

  if (isShortcutArgs(args)) {
    return {
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
