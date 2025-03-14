import {
  AllMiddlewareArgs,
  BlockButtonAction,
  BlockPlainTextInputAction,
  SlackAction,
  SlackActionMiddlewareArgs,
  SlackShortcut,
  SlackShortcutMiddlewareArgs,
  SlackViewAction,
  SlackViewMiddlewareArgs,
} from '@slack/bolt';
import { MessageShortcut } from '@slack/bolt/dist/types/shortcuts/message-shortcut';
import { ViewSubmitAction } from '@slack/bolt/dist/types/view';

export type BlockButtonWrapper<Action extends SlackAction = BlockButtonAction> =
  AllMiddlewareArgs & SlackActionMiddlewareArgs<Action>;

export type SlackActionWrapper<Action extends SlackShortcut = MessageShortcut> =
  AllMiddlewareArgs & SlackShortcutMiddlewareArgs<Action>;

export type ViewAction<Action extends SlackViewAction = ViewSubmitAction> =
  AllMiddlewareArgs & SlackViewMiddlewareArgs<Action>;

export type BlockPlainTextInputActionWrapper<
  Action extends SlackAction = BlockPlainTextInputAction,
> = AllMiddlewareArgs & SlackActionMiddlewareArgs<Action>;
