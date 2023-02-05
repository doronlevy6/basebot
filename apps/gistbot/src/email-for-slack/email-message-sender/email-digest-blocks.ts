import { KnownBlock } from '@slack/bolt';
import { Routes } from '../../routes/router';
import { DigestMessage, GmailDigestSection } from '../types';

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
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${message.title}*\n\n${message.body}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Reply',
              emoji: true,
            },
            value: `${message.id}|${message.from}`,
            action_id: Routes.MAIL_REPLY,
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Mark as read',
              emoji: true,
            },
            value: message.id,
            action_id: Routes.MAIL_MARK_AS_READ,
          },
        ],
      },
    ];
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
