import {
  AllMiddlewareArgs,
  BlockPlainTextInputAction,
  BlockStaticSelectAction,
  SlackAction,
  SlackActionMiddlewareArgs,
} from '@slack/bolt';

export type BlockStaticSelectWrapper<
  Action extends SlackAction = BlockStaticSelectAction,
> = AllMiddlewareArgs & SlackActionMiddlewareArgs<Action>;

export type BlockPlainTextInputActionWrapper<
  Action extends SlackAction = BlockPlainTextInputAction,
> = AllMiddlewareArgs & SlackActionMiddlewareArgs<Action>;
