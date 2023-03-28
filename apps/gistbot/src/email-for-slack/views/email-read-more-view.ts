import {
  ActionsBlock,
  InputBlock,
  KnownBlock,
  ModalView,
  PlainTextOption,
  SectionBlock,
} from '@slack/web-api';
import { LongTextBlock } from '../../slack/components/long-text-block';
import { SLACK_MAX_TEXT_BLOCK_LENGTH } from '../../slack/constants';
import { Routes } from '../../routes/router';
import {
  DigestMailAttachments,
  EmailCategory,
  ReplyOptions,
  ResolveActionConfig,
  ResolveMailAction,
} from '../types';
import {
  getReplyBlockId,
  REPLY_ELEMENT_ACTION_ID,
  REPLY_TO_BLOCK_ID,
} from './email-reply-view';
export const FORWARD_ACTION_ID = 'forward_email_input_action';
export const SHARE_TO_SLACK_ID = 'share_to_slack_input_block_id';
export const SHARE_TO_SLACK_ACTION_ID = 'share_to_slack_input_action_id';
export const FORWARD_ID = 'forward';
export const REPLY_OPTIONS_ID = 'reply_options_id';
export const MAIL_ACTION_NOTE_ID = 'mail_action_note';

interface IProps {
  title: string;
  body: string;
  attachments?: DigestMailAttachments[];
  messageId: string;
  from?: string;
  link: string;
  submitAction: ResolveMailAction;
  category: EmailCategory;
  cc?: string[];
  to?: string[];
}

const allowCategoriesToReply = [EmailCategory.Priority, EmailCategory.Groups];

export const shareToInputBlock = {
  type: 'section',
  text: {
    type: 'mrkdwn',
    text: 'Choose which channel to share this email',
  },
  accessory: {
    type: 'multi_conversations_select',
    placeholder: {
      type: 'plain_text',
      text: 'Select conversations',
      emoji: true,
    },
    action_id: SHARE_TO_SLACK_ACTION_ID,
  },
  block_id: SHARE_TO_SLACK_ID,
};
export const forwardInputBlock = {
  type: 'input',
  element: {
    type: 'email_text_input',
    action_id: FORWARD_ACTION_ID,
  },
  label: {
    type: 'plain_text',
    text: 'Forward to',
    emoji: true,
  },
  block_id: FORWARD_ID,
};
export const OpenView: (props: IProps) => ModalView = ({
  title,
  body,
  attachments,
  messageId,
  from,
  link,
  submitAction,
  category,
  cc,
}) => {
  const blocks = [
    ...LongTextBlock(body),
    ...createAttachmentsBlocks(attachments),
    createChangeClassificationBlock(link, messageId),
    {
      type: 'divider',
    },
    ...ReplyBlocks(from || '', category),
  ];

  return {
    type: 'modal',
    private_metadata: JSON.stringify({
      id: messageId,
      from,
      submitAction,
      category,
      cc,
      hasAttachments: !!attachments?.length,
    }),
    callback_id: Routes.RESOLVE_MAIL_FROM_VIEW,
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
const createrepllyOptionsFromEnum = (): PlainTextOption[] => {
  const options: PlainTextOption[] = [];
  for (const option in ReplyOptions) {
    options.push({
      text: {
        type: 'plain_text',
        text: ReplyOptions[option],
        emoji: true,
      },
      value: ReplyOptions[option],
    });
  }

  return options;
};

const createReplyOptionsBlock = (): ActionsBlock => {
  return {
    type: 'actions',
    block_id: REPLY_OPTIONS_ID,
    elements: [
      {
        type: 'static_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select an item',
          emoji: true,
        },
        initial_option: {
          text: {
            type: 'plain_text',
            text: ReplyOptions.Reply,
            emoji: true,
          },
          value: ReplyOptions.Reply,
        },
        options: createrepllyOptionsFromEnum(),
        action_id: Routes.EMAIL_REPLY_OPTION,
      },
    ],
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

export const createReplyBlock = (title: string): SectionBlock => {
  return {
    block_id: REPLY_TO_BLOCK_ID,
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: title,
    },
  };
};

const ReplyBlocks = (from: string, category: EmailCategory): KnownBlock[] => {
  if (!allowCategoriesToReply.includes(category)) return [];
  return [
    createReplyOptionsBlock(),
    {
      type: 'divider',
    },
    createReplyBlock(`*Reply to:* ${from}`),
    createMessageInput(),
    {
      type: 'context',
      block_id: MAIL_ACTION_NOTE_ID,
      elements: [
        {
          type: 'mrkdwn',
          text: ' ',
        },
      ],
    },
    {
      type: 'actions',
      block_id: 'button',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Save as Draft',
            emoji: true,
          },
          value: 'save_draft',
          action_id: Routes.MAIL_SAVE_DRAFT,
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

export function createMessageInput(): InputBlock {
  return {
    type: 'input',
    block_id: getReplyBlockId(),
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
      text: ' ',
      emoji: true,
    },
  };
}

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
