import { BlockAction, BlockElementAction, ButtonAction } from '@slack/bolt';
import {
  ActionsBlock,
  Block,
  Button,
  HomeView,
  Logger,
  WebClient,
} from '@slack/web-api';
import { IHomeViewMetadata } from '../types';
import { EmailHomeView } from '../views/email-home-view';

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
  const response = await client.views.update({
    user_id: body.user.id,
    view: {
      ...EmailHomeView(
        updatedBlocks,
        JSON.parse(body.view?.private_metadata ?? '{}') as IHomeViewMetadata,
      ),
    },
    view_id: body.view?.id,
  });

  if (!response.ok) {
    logger.error(
      `error in updateBlocks, couldn't update blocks. Error: ${response.error}`,
    );
  }
}
