import { ContextBlock, InputBlock } from '@slack/web-api';
import { union } from 'lodash';
import { SlackBlockActionWrapper } from '../../slack/types';
import { ReplyOptions } from '../types';
import {
  createReplyBlock,
  forwardInputBlock,
  FORWARD_ID,
  MAIL_ACTION_NOTE_ID,
} from '../views/email-read-more-view';
import { getReplyBlockId, REPLY_TO_BLOCK_ID } from '../views/email-reply-view';
import { getModalViewFromBody } from './helpers';

export const ReplyOptionsHandler =
  () => async (obj: SlackBlockActionWrapper) => {
    const { ack, logger, body, client, action } = obj;
    await ack();
    const newOption = action['selected_option']['value'];
    logger.info(`changing reply option to ${newOption}`);
    const metadata = body.view?.private_metadata;
    if (!metadata) {
      logger.error(
        `PRIVATE metadata not exist for user ${body.user?.id}} in emailReplyFromModalHandler`,
      );
      return;
    }
    const view = getModalViewFromBody(body);
    if (!view) {
      logger.error(
        `Could not extract view from body for user ${body.user?.id}} in emailReplyFromModalHandler`,
      );
      return;
    }
    const { from, cc, hasAttachments } = JSON.parse(metadata);
    const blocks = view.blocks.map((block) => {
      if (
        block.block_id === REPLY_TO_BLOCK_ID ||
        block.block_id === FORWARD_ID
      ) {
        switch (newOption) {
          case ReplyOptions.Reply:
            return createReplyBlock(`*Reply to:* ${from}`);
          case ReplyOptions.ReplyAll:
            return createReplyBlock(`*Reply to:* ${union([from], cc)}`);
          case ReplyOptions.Forward:
            return forwardInputBlock;
        }
      }
      if (block.block_id === getReplyBlockId()) {
        return {
          ...block,
          label: {
            ...(block as InputBlock).label,
            text: newOption === ReplyOptions.Forward ? 'Add message' : ' ',
          },
        };
      }
      if (hasAttachments && block.block_id === MAIL_ACTION_NOTE_ID) {
        return {
          ...block,
          elements: (block as ContextBlock).elements.map((e) => ({
            ...e,
            text:
              newOption === ReplyOptions.Forward
                ? '* Attachments are not forwarded'
                : ' ',
          })),
        };
      }

      return block;
    });

    await client.views.update({
      view_id: body.view?.id,
      view: { ...view, blocks },
    });
  };
