import {
  AllMiddlewareArgs,
  BlockPlainTextInputAction,
  BlockStaticSelectAction,
  SlackAction,
  SlackActionMiddlewareArgs,
  SlackShortcut,
  SlackShortcutMiddlewareArgs,
  SlackViewAction,
  SlackViewMiddlewareArgs,
} from '@slack/bolt';
import { MessageShortcut } from '@slack/bolt/dist/types/shortcuts/message-shortcut';
import { ViewSubmitAction } from '@slack/bolt/dist/types/view';

export type BlockStaticSelectWrapper<
  Action extends SlackAction = BlockStaticSelectAction,
> = AllMiddlewareArgs & SlackActionMiddlewareArgs<Action>;
export type SlackActionWrapper<Action extends SlackShortcut = MessageShortcut> =
  AllMiddlewareArgs & SlackShortcutMiddlewareArgs<Action>;

export type ViewAction<Action extends SlackViewAction = ViewSubmitAction> =
  AllMiddlewareArgs & SlackViewMiddlewareArgs<Action>;

export type BlockPlainTextInputActionWrapper<
  Action extends SlackAction = BlockPlainTextInputAction,
> = AllMiddlewareArgs & SlackActionMiddlewareArgs<Action>;
