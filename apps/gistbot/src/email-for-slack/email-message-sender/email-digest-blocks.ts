import { KnownBlock } from '@slack/bolt';
import { Routes } from '../../routes/router';

export const createEmailDigestBlocks = (
  gmailData: { snippet: string; subject: string; from: string; id: string }[],
) => {
  const textBlocks: KnownBlock[] = gmailData.flatMap((data) => {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${data.subject}*\n\n${data.snippet}`,
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
            value: `${data.id}|${data.from}`,
            action_id: Routes.MAIL_REPLY,
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Mark as read',
              emoji: true,
            },
            value: data.id,
            action_id: Routes.MAIL_MARK_AS_READ,
          },
        ],
      },
    ];
  });
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
  textBlocks.unshift(...opener);
  return textBlocks;
};
