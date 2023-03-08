import { KnownBlock } from '@slack/bolt';
import { Routes } from '../../routes/router';
import { splitTextBlocks } from '../utils';

export const MultiChannelSummary = (
  formattedSummaries: string[],
  sessionId: string,
): KnownBlock[] => {
  const blocksText = formattedSummaries.flatMap((fs) => splitTextBlocks(fs));
  return [
    ...blocksText.map((fs): KnownBlock => {
      return {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: fs,
        },
      };
    }),
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
          text: 'Daily Digest Settings',
        },
        value: 'scheduler-settings-button',
        action_id: Routes.OPEN_SCHEDULER_SETTINGS,
      },
    ],
  };
};
