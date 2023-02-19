import { BlockAction, BlockElementAction, ButtonAction } from '@slack/bolt';
import { Block, Logger, WebClient } from '@slack/web-api';

export async function updateButtonText(
  body: BlockAction<BlockElementAction>,
  action: ButtonAction,
  logger: Logger,
  client: WebClient,
  text: string,
) {
  const updatedBlocks = body.message?.blocks;
  let didFindButton = false;
  updatedBlocks.forEach((block) => {
    if (block.elements) {
      block.elements.forEach((element) => {
        if (
          element.type === 'button' &&
          element.value == action.value &&
          element.action_id == action.action_id
        ) {
          element.text.text = text;
          didFindButton = true;
        }
      });
    }
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
  const message_ts = body.message?.ts;
  const channel_id = body.channel?.id;
  if (message_ts && channel_id) {
    const response = await client.chat.update({
      text: body.message?.text,
      channel: channel_id,
      ts: message_ts,
      blocks: updatedBlocks,
      attachments: [],
    });
    if (!response.ok) {
      logger.error(
        `error in markAsReadHandler, couldn't update blocks. Error: ${response.error}`,
      );
    }
  } else {
    logger.error(
      `error in markAsReadHandler, couldn't get message or channel ids for user ${body.user.id}`,
    );
  }
}
