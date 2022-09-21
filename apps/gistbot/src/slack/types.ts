import {
  AllMiddlewareArgs,
  SlackShortcut,
  SlackShortcutMiddlewareArgs,
} from '@slack/bolt';
import { MessageShortcut } from '@slack/bolt/dist/types/shortcuts/message-shortcut';

export type SlackActionWrapper<Action extends SlackShortcut = MessageShortcut> =
  AllMiddlewareArgs & SlackShortcutMiddlewareArgs<Action>;
