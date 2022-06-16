import {
  AllMiddlewareArgs,
  BlockStaticSelectAction,
  SlackAction,
  SlackActionMiddlewareArgs,
} from '@slack/bolt';

export type BlockStaticSelectWrapper<
  Action extends SlackAction = BlockStaticSelectAction,
> = AllMiddlewareArgs & SlackActionMiddlewareArgs<Action>;
