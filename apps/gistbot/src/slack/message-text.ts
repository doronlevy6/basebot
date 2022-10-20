import {
  Attachment,
  Block,
} from '@slack/web-api/dist/response/ConversationsRepliesResponse';
import { SlackMessage } from '../summaries/types';

export function extractMessageText(
  message: SlackMessage,
  transform: boolean,
): string {
  let text = '';

  if (message.text) {
    text = message.text;
    if (transform) {
      text = transformTextToNoLineBreaks(text);
    }
  }

  if (message.blocks) {
    let blockText = extractTextFromBlocks(message.blocks);
    if (transform) {
      blockText = transformTextToNoLineBreaks(blockText);
    }
    if (blockText) {
      text = `${text}. ${blockText}`;
    }
  }

  if (message.attachments) {
    let attachmentsText = extractTextFromAttachments(message.attachments);
    if (transform) {
      attachmentsText = transformTextToNoLineBreaks(attachmentsText);
    }

    if (attachmentsText) {
      text = `${text}. ${attachmentsText}`;
    }
  }

  return text.trim();
}

function transformTextToNoLineBreaks(text: string): string {
  return text
    .split('\n')
    .filter((t) => {
      return t.trim().length > 0;
    })
    .map((t) => {
      if (t[t.length - 1] === '.') {
        return t;
      }
      return `${t}.`;
    })
    .join(' ');
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
