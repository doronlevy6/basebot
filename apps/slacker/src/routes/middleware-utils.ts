import {
  AnyMiddlewareArgs,
  SlackActionMiddlewareArgs,
  SlackCommandMiddlewareArgs,
  SlackViewMiddlewareArgs,
  SlackShortcutMiddlewareArgs,
  SlackEventMiddlewareArgs,
  SlackOptionsMiddlewareArgs,
} from '@slack/bolt';

export function isActionArgs(
  args: AnyMiddlewareArgs,
): args is SlackActionMiddlewareArgs {
  return (args as SlackActionMiddlewareArgs).action !== undefined;
}

export function isCommandArgs(
  args: AnyMiddlewareArgs,
): args is SlackCommandMiddlewareArgs {
  return (args as SlackCommandMiddlewareArgs).command !== undefined;
}

export function isViewArgs(
  args: AnyMiddlewareArgs,
): args is SlackViewMiddlewareArgs {
  return (args as SlackViewMiddlewareArgs).view !== undefined;
}

export function isShortcutArgs(
  args: AnyMiddlewareArgs,
): args is SlackShortcutMiddlewareArgs {
  return (args as SlackShortcutMiddlewareArgs).shortcut !== undefined;
}

export function isEventArgs(
  args: AnyMiddlewareArgs,
): args is SlackEventMiddlewareArgs {
  return (args as SlackEventMiddlewareArgs).event !== undefined;
}

export function isOptionsArgs(
  args: AnyMiddlewareArgs,
): args is SlackOptionsMiddlewareArgs {
  return (args as SlackOptionsMiddlewareArgs).options !== undefined;
}
