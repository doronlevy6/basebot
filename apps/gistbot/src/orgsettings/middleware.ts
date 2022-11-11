import { AnyMiddlewareArgs, Context, Middleware } from '@slack/bolt';
import {
  isActionArgs,
  isCommandArgs,
  isViewArgs,
  isShortcutArgs,
  isEventArgs,
} from '../slack/middleware-utils';
import { OrgSettings, OrgSettingsStore } from './store';

const GISTBOT_ORG_SETTINGS_CONTEXT_KEY = 'gistbot_org_settings';

export const getOrgSettingsFromContext = (
  context: Context,
): OrgSettings | undefined => {
  return context[GISTBOT_ORG_SETTINGS_CONTEXT_KEY];
};

interface teamAndEnterprise {
  teamId?: string;
  enterpriseId?: string;
}

export const orgSettingsMiddleware =
  (orgSettingsStore: OrgSettingsStore): Middleware<AnyMiddlewareArgs> =>
  async (args) => {
    const { logger, next, context } = args;

    // This is a middleware that should only be run once per event, but I don't trust the way bolt works
    // because I've seen that sometimes it will run a middleware and an event listener concurrently to others running
    // on the same event, and it runs all of the listeners as opposed to the first matching one like a normal router.
    // So to avoid unnecessary over work, this check should see if there's already a settings object on the context,
    // and skip the middleware if there is one.
    if (getOrgSettingsFromContext(context)) {
      await next();
      return;
    }

    const vals = getTeamId(args);
    if (!vals) {
      await next();
      return;
    }

    try {
      // In order to persuade the type system that one of them exists within the if statement,
      // we need to declare a separate variable that is one or the other so that it can be checked.
      // Doing this:
      // if (vals.teamId || vals.enterpriseId) {
      //   await orgSettingsStore.getSettings(vals.teamId || vals.enterpriseId)
      // }
      // should be functionally equivalent, but the type system isn't smart enough to say that if I'm
      // checking for at least one of them, if I use the same condition at least one of them will exist as a string.
      const org = vals.teamId || vals.enterpriseId;
      if (org) {
        const settings = await orgSettingsStore.getSettings(org);
        logger.debug({
          msg: `attaching org settings to event context`,
          orgSettings: settings,
        });
        context[GISTBOT_ORG_SETTINGS_CONTEXT_KEY] = settings;
      }
      // TODO: What should we do if we don't have the org ID?
      // I think we are supposed to get a team_id or enterprise_id for all events,
      // but for some reason the team_id/enterprise_id is always optional on all Slack types.
      // Maybe we won't get it on certain events? What should we do there... should we set a default or something?
      // Setting a default may be problematic, if for some reason there isn't a team_id on an event that is affected
      // by an org setting, we could unintentionally do something incorrectly.
      // For now it will be undefined and we'll let the user decide.
    } catch (error) {
      logger.error({
        msg: `error in org settings middleware`,
        error: error.message,
        stack: error.stack,
      });
    }

    await next();
  };

function getTeamId(args: AnyMiddlewareArgs): teamAndEnterprise | undefined {
  if (isActionArgs(args)) {
    return {
      teamId: args.body.team?.id,
      enterpriseId: args.body.enterprise?.id,
    };
  }

  if (isCommandArgs(args)) {
    return {
      teamId: args.body.team_id,
      enterpriseId: args.body.enterprise_id,
    };
  }

  if (isViewArgs(args)) {
    return {
      teamId: args.body.team?.id,
      enterpriseId: args.body.enterprise?.id,
    };
  }

  if (isShortcutArgs(args)) {
    return {
      teamId: args.body.team?.id,
      enterpriseId: args.body.enterprise?.id,
    };
  }

  if (isEventArgs(args)) {
    return {
      teamId: args.body.team_id,
      enterpriseId: args.body.enterprise_id,
    };
  }
}
