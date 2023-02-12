import { Button, KnownBlock } from '@slack/bolt';
import { Routes } from '../../routes/router';
import { DigestAction, DigestMessage, GmailDigestSection } from '../types';

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

const markAllAsReadAction = (message: DigestMessage): Button => {
  return {
    type: 'button',
    text: {
      type: 'plain_text',
      text: 'Mark all as read',
      emoji: true,
    },
    value: message.id,
    action_id: Routes.MAIL_MARK_ALL_AS_READ,
  };
};

const rsvpAction = (message: DigestMessage): Button => {
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

const createEmailDigestSections = (
  sections: GmailDigestSection[],
): KnownBlock[] => {
  return sections.flatMap((section) => {
    return [
      createEmailDigestHeader(section.title),
      ...createEmailDigestMessage(section.messages),
      {
        type: 'divider',
      },
    ];
  });
};

const createEmailDigestHeader = (title: string): KnownBlock => {
  return {
    type: 'header',
    text: {
      type: 'plain_text',
      text: `${title}`.toUpperCase(),
    },
  };
};

const createEmailDigestMessage = (messages: DigestMessage[]): KnownBlock[] => {
  return messages.flatMap((message) => {
    const blocks: KnownBlock[] = [];
    const bodySection: KnownBlock = {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${message.title}*\n\n${message.body}`,
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
          return markAllAsReadAction(message);
        case DigestAction.Reply:
          return replyAction(message);
        case DigestAction.RSVP:
          return rsvpAction(message);
      }
    })
    .filter((button) => {
      return button !== undefined;
    });
};

export const createEmailDigestBlocks = (sections: GmailDigestSection[]) => {
  const opener: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Your Email Summary ',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: new Date().toDateString(),
      },
    },
    {
      type: 'divider',
    },
  ];

  const blocks: KnownBlock[] = [
    ...opener,
    ...createEmailDigestSections(sections),
  ];

  return blocks;
};
