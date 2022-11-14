import { KnownBlock } from '@slack/bolt';
import { Routes } from '../../routes/router';

export const MultiChannelSummary = (
  formattedText: string,
  sessionId: string,
): KnownBlock[] => {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: formattedText,
      },
    },
    {
      type: 'divider',
    },
    Actions(sessionId),
  ];
};

const Actions = (sessionId: string): KnownBlock => {
  return {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Got Feedback?',
        },
        action_id: Routes.SEND_USER_FEEDBACK,
        value: sessionId,
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Schedule Summary Settings',
        },
        value: 'scheduler-settings-button',
        action_id: Routes.OPEN_SCHEDULER_SETTINGS,
      },
    ],
  };
};
