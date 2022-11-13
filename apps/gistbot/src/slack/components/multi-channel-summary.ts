import { KnownBlock } from '@slack/bolt';
import { FreetextFeedback } from './freetext-feedback';

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
    ...FreetextFeedback('How was this digest?', sessionId),
  ];
};
