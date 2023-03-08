import { KnownBlock, ModalView } from '@slack/web-api';
import { LongTextBlock } from '../../slack/components/long-text-block';
import { SLACK_MAX_TEXT_BLOCK_LENGTH } from '../../slack/constants';
import { DigestMailAttachments } from '../types';

interface IProps {
  title: string;
  body: string;
  attachments?: DigestMailAttachments[];
}

export const ReadMoreView: (props: IProps) => ModalView = ({
  title,
  body,
  attachments,
}) => {
  const blocks = [
    ...LongTextBlock(body),
    ...createAttachmentsBlocks(attachments),
  ];

  return {
    type: 'modal',
    close: {
      type: 'plain_text',
      text: 'Done',
      emoji: true,
    },
    title: {
      type: 'plain_text',
      text: title,
      emoji: true,
    },
    blocks,
  };
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
