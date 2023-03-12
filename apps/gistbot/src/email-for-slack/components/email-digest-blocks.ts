import { Button, KnownBlock, Option } from '@slack/bolt';
import { Routes } from '../../routes/router';
import {
  DigestAction,
  DigestMessage,
  EmailCategoryToEmoji,
  EmailCategoryToName,
  GmailDigestSection,
  ResolveActionConfig,
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

const resolveMailAction = (messageId: string, action: DigestAction) => {
  const cfg = ResolveActionConfig[action];
  return (
    cfg && {
      type: 'button',
      text: {
        type: 'plain_text',
        text: cfg.fullName,
        emoji: true,
      },
      value: JSON.stringify({
        id: messageId,
        submitAction: action,
      }),
      action_id: Routes.RESOLVE_MAIL,
    }
  );
};

const resolveMailOption = (id: string, action): Option => {
  const cfg = ResolveActionConfig[action];
  return (
    cfg && {
      text: {
        type: 'plain_text',
        text: cfg.fullName,
        emoji: true,
      },
      value: JSON.stringify({ id, submitAction: action }),
    }
  );
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
  const emailDigestHeaderLength = 1;
  const dividerBlockLength = 1;
  let blocksLength = emailDigestHeaderLength + dividerBlockLength;
  const result: KnownBlock[] = [];
  let totalBlocksLength = 0;
  for (const section of sections) {
    const emailDigestHeader = createEmailDigestHeader(section);
    const mailDigestMessages = createEmailDigestMessage(section.messages);
    // Calculate the length of the blocks to be added
    const addedBlocksLength =
      emailDigestHeaderLength + mailDigestMessages.length + dividerBlockLength;
    totalBlocksLength = totalBlocksLength + addedBlocksLength;
    // Check if adding the blocks will exceed the limit

    if (blocksLength + addedBlocksLength > limitBlocksSize) {
      // Calculate the remaining space in the blocks
      const remainingSpace = limitBlocksSize - blocksLength;
      // If there is not enough space for even one mailDigestMessage, skip this section and continue with the next one
      if (remainingSpace < emailDigestHeaderLength + dividerBlockLength) {
        logger.info(`Skipping sections due to over blocks limit`);
        break;
      }
      const toSlice =
        remainingSpace % 2 === 0 ? remainingSpace : remainingSpace - 1;
      // Slice the mailDigestMessages to fit within the remaining space the mod 2 required cause each section is 2 blocks actions and message
      const slicedMailDigestMessages = mailDigestMessages.slice(0, toSlice);

      // Add the blocks to the result array
      result.push(emailDigestHeader, ...slicedMailDigestMessages, {
        type: 'divider',
      });
      blocksLength +=
        emailDigestHeaderLength +
        slicedMailDigestMessages.length +
        dividerBlockLength;
    } else {
      // Add the blocks to the result array
      result.push(emailDigestHeader, ...mailDigestMessages, {
        type: 'divider',
      });
      blocksLength +=
        emailDigestHeaderLength +
        mailDigestMessages.length +
        dividerBlockLength;
    }
  }
  const dropBlocksCount = totalBlocksLength - blocksLength;
  if (dropBlocksCount > 0) {
    logger.info(
      `during creation email dropped:${dropBlocksCount} disgets sections `,
    );
  } else {
    logger.info(`during creation email disgets sections added ${blocksLength}`);
  }

  return result;
};

const createEmailDigestHeader = (section: GmailDigestSection): KnownBlock => {
  const options = createDigestSectionActions(section);
  const sectionHeader: KnownBlock = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${EmailCategoryToEmoji.get(section.category) || ':e-mail:'}  ${
        EmailCategoryToName.get(section.category) || ''
      }*`,
    },
  };

  if (options?.length) {
    sectionHeader.accessory = {
      type: 'overflow',
      action_id: Routes.RESOLVE_MAIL,
      options,
    };
  }

  return sectionHeader;
};

const createEmailDigestMessage = (messages: DigestMessage[]): KnownBlock[] => {
  return messages.flatMap((message) => {
    const { timeStamp, body, title } = message;
    const time = timeStamp ? createTimeString(timeStamp) : '';
    const messageTitle = `*${title}*${time}\n\n${body}`;
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
      if (action in ResolveActionConfig) {
        return resolveMailAction(message.id, action);
      }
      switch (action) {
        case DigestAction.Reply:
          return replyAction(message);
        case DigestAction.ReadMore:
          return readMoreAction(message);
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
    ?.filter((action) => ResolveActionConfig[action]?.isBulkAction)
    .map((action) =>
      resolveMailOption(section.id as string, action),
    ) as Option[];
};

export const readMoreAction = (message: DigestMessage): Button => {
  return {
    type: 'button',
    text: {
      type: 'plain_text',
      text: 'Open',
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

const createTimeString = (timestamp: number) => {
  const date = new Date(timestamp);
  const isToday = date.getTime() >= new Date().setHours(0, 0, 0, 0);
  if (isToday) {
    return ` (<!date^${timestamp / 1000}^{time}| >) `;
  }
  return ` (<!date^${timestamp / 1000}^{date_short_pretty}| >) `;
};
