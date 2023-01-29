import { KnownBlock } from '@slack/bolt';

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
            action_id: 'mail-reply-action',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Mark as read',
              emoji: true,
            },
            value: 'click_me_123',
            action_id: 'actionId-1',
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
