import { KnownBlock } from '@slack/web-api';
import { Routes } from '../../routes/router';

export const FreetextFeedback = (
  messageText: string,
  sessionId: string,
): KnownBlock[] => {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: messageText,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Add a comment',
          },
          value: sessionId,
          action_id: Routes.SEND_USER_FEEDBACK,
        },
      ],
    },
  ];
};
