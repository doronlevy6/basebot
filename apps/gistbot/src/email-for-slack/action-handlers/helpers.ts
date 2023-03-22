import { BlockAction, BlockElementAction, ButtonAction } from '@slack/bolt';
import {
  ActionsBlock,
  Block,
  Button,
  HomeView,
  Logger,
  ModalView,
  WebClient,
} from '@slack/web-api';

export async function updateButtonText(
  body: BlockAction<BlockElementAction>,
  action: ButtonAction,
  logger: Logger,
  client: WebClient,
  text: string,
) {
  if (!body.view || body.view.type !== 'home') {
    logger.error(
      `email updateButtonText couldn't find view to update for user ${body.user.id}`,
    );
    return;
  }

  const view = body.view as unknown as HomeView;
  const updatedBlocks = [...view.blocks];
  let didFindButton = false;
  updatedBlocks.forEach((block) => {
    if (block.type !== 'actions') {
      return;
    }
    const actionsBlock = block as ActionsBlock;
    actionsBlock.elements.forEach((element) => {
      if (element.type !== 'button') {
        return;
      }

      const buttonAction = element as Button;
      if (
        buttonAction.value == action.value &&
        buttonAction.action_id == action.action_id
      ) {
        buttonAction.text.text = text;
        didFindButton = true;
      }
    });
  });

  if (!didFindButton) {
    logger.error(
      `email updateButtonText couldn't find button to update for user ${body.user.id}`,
    );
  }

  await updateBlocks(body, client, updatedBlocks, logger);
}

async function updateBlocks(
  body: BlockAction<BlockElementAction>,
  client: WebClient,
  updatedBlocks: Block[],
  logger: Logger,
) {
  try {
    if (!body.view || body.view.type !== 'home') {
      logger.error(
        `email updateBlocks couldn't find view to update for user ${body.user.id}`,
      );
      return;
    }

    const response = await client.views.update({
      user_id: body.user.id,
      view: {
        type: 'home',
        blocks: updatedBlocks,
        private_metadata: body.view.private_metadata,
      },
      view_id: body.view?.id,
    });

    logger.debug(`Updated home blocks for ${body.user.id}`);
    if (!response.ok) {
      logger.error(
        `error in updateBlocks, couldn't update blocks. Error: ${response.error}`,
      );
    }
  } catch (e) {
    logger.error(`error in updateBlocks, couldn't update blocks. Error: ${e}`);
  }
}

export const getModalViewFromBody = ({
  view,
}: BlockAction<BlockElementAction>): ModalView | undefined => {
  if (!view) {
    return undefined;
  }
  return {
    type: 'modal',
    title: view.title,
    blocks: view.blocks as Block[],
    close: view.close || undefined,
    submit: view.submit || undefined,
    private_metadata: view.private_metadata,
    callback_id: view.callback_id,
    clear_on_close: view.clear_on_close,
    notify_on_close: view.notify_on_close,
    external_id: view.external_id,
  };
};

export function getDynamicId(prefix: string): [() => string, () => void] {
  let counter = 0;
  const getId = () => prefix + counter;

  const increment = () => {
    counter++;
  };
  return [getId, increment];
}
