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
import { UserOnboardedNotifier } from './notifier';
import { OnboardingLock } from './onboarding-lock';
import { OnboardingStore } from './onboardingStore';

interface slackIds {
  type: 'user-interaction';
  teamId: string;
  userId: string;
  respond: RespondFn;
}

export const userOnboardingMiddleware =
  (
    onboardingStore: OnboardingStore,
    analyticsManager: AnalyticsManager,
    onboardingNotifier: UserOnboardedNotifier,
    onboardingLock: OnboardingLock,
  ): Middleware<AnyMiddlewareArgs> =>
  async (args) => {
    const { logger, next, client, context } = args;
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
        const acquireOnboarding = await onboardingLock.lock(
          vals.teamId,
          vals.userId,
        );

        if (acquireOnboarding) {
          await vals.respond({
            response_type: 'ephemeral',
            text: `Hey ${UserLink(vals.userId)} :wave: I'm theGist!`,
            blocks: Welcome(vals.userId, context.botUserId || ''),
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

          // Don't await so that we don't force anything to wait just for the notification.
          // This handles error handling internally and will never cause an exception, so we
          // won't have any unhandled promise rejection errors.
          onboardingNotifier.notify(client, vals.userId, vals.teamId);
        } else {
          logger.info(
            `user ${vals.userId} is being onboarded elsewhere, skipping middleware onboarding`,
          );
        }
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
