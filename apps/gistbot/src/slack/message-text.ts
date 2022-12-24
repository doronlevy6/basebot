import { WebClient } from '@slack/web-api';
import {
  Attachment,
  Block,
} from '@slack/web-api/dist/response/ConversationsRepliesResponse';
import { SlackMessage } from '../summaries/types';
import { defaultParseTextOpts, parseSlackMrkdwn } from './parser';
import { SlackDataStore } from '../utils/slack-data-store';

export async function extractMessageText(
  message: SlackMessage,
  transform: boolean,
  teamId: string,
  client: WebClient,
  slackDataStore: SlackDataStore,
): Promise<string> {
  let text = '';

  if (message.text) {
    text = message.text;
    if (transform) {
      text = transformTextToNoLineBreaks(text);
    }
  }

  if (!message.bot_id) {
    return text.trim();
  }

  if (message.blocks?.length) {
    let blocksText = await parseSlackMrkdwn(
      extractTextFromBlocks(message.blocks),
    ).plainText(teamId, client, defaultParseTextOpts, slackDataStore);
    if (transform) {
      blocksText = transformTextToNoLineBreaks(blocksText);
    }
    if (text) {
      text += '.';
    }
    text = `${text}${blocksText}`;
  }

  if (message.attachments?.length) {
    let attachmentsText = await parseSlackMrkdwn(
      extractTextFromAttachments(message.attachments),
    ).plainText(teamId, client, defaultParseTextOpts, slackDataStore);
    if (transform) {
      attachmentsText = transformTextToNoLineBreaks(attachmentsText);
    }
    if (text) {
      text += '.';
    }
    text = `${text}${attachmentsText}`;
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
