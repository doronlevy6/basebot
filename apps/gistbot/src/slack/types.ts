import {
  AllMiddlewareArgs,
  BlockAction,
  SlackAction,
  SlackActionMiddlewareArgs,
  SlackCommandMiddlewareArgs,
  SlackShortcut,
  SlackShortcutMiddlewareArgs,
  SlackViewAction,
  SlackViewMiddlewareArgs,
  ViewSubmitAction,
} from '@slack/bolt';
import { MessageShortcut } from '@slack/bolt/dist/types/shortcuts/message-shortcut';

export type SlackSlashCommandWrapper = AllMiddlewareArgs &
  SlackCommandMiddlewareArgs;

export type SlackShortcutWrapper<
  Action extends SlackShortcut = MessageShortcut,
> = AllMiddlewareArgs & SlackShortcutMiddlewareArgs<Action>;

export type SlackBlockActionWrapper<Action extends SlackAction = BlockAction> =
  AllMiddlewareArgs & SlackActionMiddlewareArgs<Action>;

export type ViewAction<Action extends SlackViewAction = ViewSubmitAction> =
  AllMiddlewareArgs & SlackViewMiddlewareArgs<Action>;
