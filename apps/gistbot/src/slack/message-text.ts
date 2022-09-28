import {
  Attachment,
  Block,
} from '@slack/web-api/dist/response/ConversationsRepliesResponse';
import { SlackMessage } from '../summaries/types';

export function extractMessageText(message: SlackMessage): string {
  let text = '';

  if (message.text) {
    text = `${message.text}`;
  }

  if (message.blocks) {
    text = `${text}\n\n${extractTextFromBlocks(message.blocks)}`;
  }

  if (message.attachments) {
    text = `${text}\n\n${extractTextFromAttachments(message.attachments)}`;
  }

  return text.trim();
}

function extractTextFromAttachments(attachments: Attachment[]): string {
  return attachments.reduce((acc, current, idx) => {
    const internalAcc = `${current.title || ''}\n\n${
      current.pretext || current.fallback || ''
    }\n\n${current.text || ''}\n\n${current.footer || ''}`;

    if (idx === 0) {
      return internalAcc;
    }

    return `${acc}\n\n${internalAcc.trim()}`;
  }, '');
}

function extractTextFromBlocks(blocks: Block[]): string {
  return blocks.reduce((acc, current, idx) => {
    if (!current.text) {
      return acc; // if there's no text object, we'll skip this block (for now at least)
    }

    if (idx === 0) {
      return current.text.text || '';
    }

    return `${acc}\n\n${current.text.text || ''}`;
  }, '');
}
