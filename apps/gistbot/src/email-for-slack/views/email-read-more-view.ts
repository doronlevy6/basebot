import { KnownBlock, ModalView } from '@slack/web-api';
import { LongTextBlock } from '../../slack/components/long-text-block';
import { SLACK_MAX_TEXT_BLOCK_LENGTH } from '../../slack/constants';
import { Routes } from '../../routes/router';
import {
  DigestMailAttachments,
  EmailCategory,
  ResolveActionConfig,
  ResolveMailAction,
} from '../types';
import { REPLY_BLOCK_ID, REPLY_ELEMENT_ACTION_ID } from './email-reply-view';

interface IProps {
  title: string;
  body: string;
  attachments?: DigestMailAttachments[];
  messageId: string;
  from?: string;
  link: string;
  submitAction: ResolveMailAction;
  category: EmailCategory;
}

const allowCategoriesToReply = [EmailCategory.Priority, EmailCategory.Groups];

export const ReadMoreView: (props: IProps) => ModalView = ({
  title,
  body,
  attachments,
  messageId,
  from,
  link,
  submitAction,
  category,
}) => {
  const blocks = [
    ...LongTextBlock(body),
    ...createAttachmentsBlocks(attachments),
    createChangeClassificationBlock(link, messageId),
    {
      type: 'divider',
    },
    ...ReplyBlock(from || '', category),
  ];

  return {
    type: 'modal',
    private_metadata: JSON.stringify({
      id: messageId,
      from,
      submitAction,
    }),
    callback_id: Routes.RESOLVE_MAIL_FROM_VIEW,
    close: {
      type: 'plain_text',
      text: 'Cancel',
      emoji: true,
    },
    title: {
      type: 'plain_text',
      text: title,
      emoji: true,
    },
    submit: {
      type: 'plain_text',
      text: ResolveActionConfig[submitAction]?.name || '',
      emoji: true,
    },

    blocks,
  };
};

function createChangeClassificationBlock(
  link: string,
  messageId: string,
): KnownBlock {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `<${link}|See original email  >`,
    },
    accessory: {
      type: 'button',
      text: {
        type: 'plain_text',
        text: 'Change Email Classification',
        emoji: true,
      },
      value: messageId,
      action_id: 'classification-action',
    },
    block_id: 'change-classification-block',
  };
}

const ReplyBlock = (from: string, category: EmailCategory) => {
  if (!allowCategoriesToReply.includes(category)) return [];
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Reply to:* ${from}`,
      },
    },
    {
      type: 'input',
      block_id: REPLY_BLOCK_ID,
      optional: true,
      element: {
        type: 'plain_text_input',
        multiline: true,
        min_length: 1,
        placeholder: {
          type: 'plain_text',
          text: 'Write something',
          emoji: true,
        },

        action_id: REPLY_ELEMENT_ACTION_ID,
      },
      label: {
        type: 'plain_text',
        text: 'Reply content',
        emoji: true,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Save as Draft',
            emoji: true,
          },
          value: 'save_draft',
          action_id: 'save_draft',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Send',
            emoji: true,
          },
          style: 'primary',
          action_id: Routes.MAIL_REPLY_FROM_MODAL,
        },
      ],
    },
  ];
};

function createAttachmentsBlocks(
  attachments: DigestMailAttachments[] | undefined,
): KnownBlock[] {
  const blocks: KnownBlock[] = [];
  if (attachments && attachments.length > 0) {
    const attachmentSectionTitle: KnownBlock = {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Attachments (${attachments.length})`,
      },
    };
    blocks.push(attachmentSectionTitle);

    // Split attachments into blocks of up to 3000 characters each
    const attachmentBlocks: string[][] = [];
    let currentBlock: string[] = [];
    let currentBlockLength = 0;
    for (const attachment of attachments) {
      const attachmentString = `<${attachment.link}|${attachment.filename}>`;
      //check block characters limit with consider in separator   ' ,' for each attachment
      if (
        currentBlockLength + attachmentString.length + currentBlock.length * 2 >
        SLACK_MAX_TEXT_BLOCK_LENGTH
      ) {
        attachmentBlocks.push(currentBlock);
        currentBlock = [attachmentString];
        currentBlockLength = attachmentString.length;
      } else {
        currentBlock.push(attachmentString);
        currentBlockLength += attachmentString.length;
      }
    }
    if (currentBlock.length > 0) {
      attachmentBlocks.push(currentBlock);
    }
    // Add attachment sections to blocks
    for (let i = 0; i < attachmentBlocks.length; i++) {
      const attachmentSection: KnownBlock = {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: attachmentBlocks[i].join(' ,'),
        },
      };
      blocks.push(attachmentSection);
    }
  }
  return blocks;
}
