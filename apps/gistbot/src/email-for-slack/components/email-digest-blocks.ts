import { Button, KnownBlock, Option } from '@slack/bolt';
import { Routes } from '../../routes/router';
import {
  DigestAction,
  DigestMessage,
  EmailCategoryToEmoji,
  GmailDigestSection,
} from '../types';
import { logger } from '@base/logger';
import { InboxZero } from './inbox-zero';

const replyAction = (message: DigestMessage): Button => {
  return {
    type: 'button',
    text: {
      type: 'plain_text',
      text: 'Reply',
      emoji: true,
    },
    value: `${message.id}|${message.from}`,
    action_id: Routes.MAIL_REPLY,
  };
};

const markAsReadAction = (message: DigestMessage): Button => {
  return {
    type: 'button',
    text: {
      type: 'plain_text',
      text: 'Mark as read',
      emoji: true,
    },
    value: message.id,
    action_id: Routes.MAIL_MARK_AS_READ,
  };
};

const markAllAsReadAction = (id: string): Button => {
  return {
    type: 'button',
    text: {
      type: 'plain_text',
      text: 'Mark all as read',
      emoji: true,
    },
    value: id,
    action_id: Routes.MAIL_MARK_ALL_AS_READ,
  };
};

const markAllAsReadOption = (id: string): Option => {
  return {
    text: {
      type: 'plain_text',
      text: 'Mark all as read',
      emoji: true,
    },
    value: JSON.stringify({ id, actionType: DigestAction.MarkAllAsRead }),
  };
};

const archiveAllAction = (id: string): Button => {
  return {
    type: 'button',
    text: {
      type: 'plain_text',
      text: 'Archive all',
      emoji: true,
    },
    value: id,
    action_id: Routes.ARCHIVE_ALL,
  };
};

const archiveAlloption = (id: string): Option => {
  return {
    text: {
      type: 'plain_text',
      text: 'Archive all',
      emoji: true,
    },
    value: JSON.stringify({ id, actionType: DigestAction.ArchiveAll }),
  };
};

const archiveAction = (message: DigestMessage): Button => {
  return {
    type: 'button',
    text: {
      type: 'plain_text',
      text: 'Archive',
      emoji: true,
    },
    value: message.id,
    action_id: Routes.ARCHIVE,
  };
};

/*const rsvpAction = (message: DigestMessage): Button => {
  return {
    type: 'button',
    text: {
      type: 'plain_text',
      text: 'RSVP',
      emoji: true,
    },
    value: message.id,
    action_id: Routes.MAIL_RSVP,
  };
};
*/

const createEmailDigestSections = (
  sections: GmailDigestSection[],
  limitBlocksSize: number,
): KnownBlock[] => {
  const footerBlocksLength = 2;
  const dividerBlockLength = 1;
  let blocksLength = 0;
  const result: KnownBlock[] = [];
  let totalBlocksLength = 0;
  for (const section of sections) {
    const emailDigestHeader = createEmailDigestHeader(section);
    const mailDigestMessages = createEmailDigestMessage(section.messages);
    // Calculate the length of the blocks to be added
    const addedBlocksLength =
      emailDigestHeader.length + mailDigestMessages.length + 1; // Add 1 for the divider block
    totalBlocksLength = totalBlocksLength + addedBlocksLength;
    // Check if adding the blocks will exceed the limit
    if (blocksLength + addedBlocksLength > limitBlocksSize) {
      // Calculate the remaining space in the blocks
      const remainingSpace = limitBlocksSize - blocksLength - 1; // Subtract 1 for the divider block
      // If there is not enough space for even one mailDigestMessage, skip this section and continue with the next one
      if (
        remainingSpace <
        emailDigestHeader.length + footerBlocksLength + dividerBlockLength
      ) {
        logger.info(
          `Skipping section ${section.category} due to over blocks limit`,
        );
        continue;
      }
      const toSlice =
        (remainingSpace - emailDigestHeader.length - 1) % 2 === 0
          ? remainingSpace - emailDigestHeader.length - 1
          : remainingSpace - emailDigestHeader.length - 2;
      // Slice the mailDigestMessages to fit within the remaining space the mod 2 required cause each section is 2 blocks actions and message
      const slicedMailDigestMessages = mailDigestMessages.slice(0, toSlice);

      // Add the blocks to the result array
      result.push(...emailDigestHeader, ...slicedMailDigestMessages, {
        type: 'divider',
      });
      blocksLength = limitBlocksSize;
    } else {
      // Add the blocks to the result array
      result.push(...emailDigestHeader, ...mailDigestMessages, {
        type: 'divider',
      });
      blocksLength += addedBlocksLength;
    }
  }
  const dropBlocksCount = totalBlocksLength - blocksLength;
  if (dropBlocksCount > 0) {
    logger.info(`during creation email disgets sections ${dropBlocksCount}`);
  } else {
    logger.info(`during creation email disgets sections added ${blocksLength}`);
  }

  return result;
};

const createEmailDigestHeader = (section: GmailDigestSection): KnownBlock[] => {
  const sectionHeader: KnownBlock = {
    type: 'header',
    text: {
      type: 'plain_text',
      text: `${
        EmailCategoryToEmoji.get(section.category) || ':e-mail:'
      }  ${section.title.toUpperCase()}`,
    },
  };

  const sectionAction: KnownBlock = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: ' ',
    },
  };

  const options = createDigestSectionActions(section);
  if (options?.length) {
    sectionAction.accessory = {
      type: 'overflow',
      action_id: Routes.EMAIL_SECTION_ACTION,
      options,
    };
  }
  return [sectionHeader, sectionAction];
};

const createEmailDigestMessage = (messages: DigestMessage[]): KnownBlock[] => {
  return messages.flatMap((message) => {
    // If there is a timestamp, add it at the end of title.
    const messageTitle = message.timeStamp
      ? `*${message.title}* (${message.timeStamp}) \n\n${message.body}`
      : `*${message.title}*\n\n${message.body}`;
    const blocks: KnownBlock[] = [];

    const bodySection: KnownBlock = {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: messageTitle,
      },
    };
    blocks.push(bodySection);

    const actions = createDigestActions(message);
    if (actions.length) {
      const actionBlock: KnownBlock = {
        type: 'actions',
        elements: actions,
      };
      blocks.push(actionBlock);
    }

    return blocks;
  });
};

export const createDigestActions = (message: DigestMessage): Button[] => {
  return message.actions
    .flatMap((action) => {
      switch (action) {
        case DigestAction.MarkAsRead:
          return markAsReadAction(message);
        case DigestAction.MarkAllAsRead:
          return markAllAsReadAction(message.id);
        case DigestAction.Reply:
          return replyAction(message);
        case DigestAction.ReadMore:
          return readMoreAction(message);
        case DigestAction.ArchiveAll:
          return archiveAllAction(message.id);
        case DigestAction.Archive:
          return archiveAction(message);
      }
    })
    .filter((button) => {
      return button !== undefined;
    }) as Button[];
};

export const createDigestSectionActions = (
  section: GmailDigestSection,
): Option[] => {
  return section.actions
    ?.flatMap((action) => {
      switch (action) {
        case DigestAction.MarkAllAsRead:
          return markAllAsReadOption(section.id as string);
        case DigestAction.ArchiveAll:
          return archiveAlloption(section.id as string);
      }
    })
    .filter((option) => {
      return option !== undefined;
    }) as Option[];
};

export const readMoreAction = (message: DigestMessage): Button => {
  const relatedMails = message.relatedMails;
  if (relatedMails) {
    const classifications = relatedMails[0].classifications;
    if (classifications) {
      const type = classifications[0].type;
    } else {
      logger.error('error in readMoreAction - classifications is undefined');
    }
  } else {
    logger.error('error in readMoreAction - relatedMails is undefined');
  }
  const textButton =
    message.attachments?.length || 0 > 0
      ? 'Read more :paperclip:'
      : 'Read more';

  return {
    type: 'button',
    text: {
      type: 'plain_text',
      text: textButton,
      emoji: true,
    },
    value: message.id,
    action_id: Routes.MAIL_READ_MORE,
  };
};

export const createEmailDigestBlocks = (
  sections: GmailDigestSection[],
  limitBlocksSize: number,
) => {
  return sections.length
    ? createEmailDigestSections(sections, limitBlocksSize)
    : InboxZero();
};
