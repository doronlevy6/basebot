import { Block, KnownBlock } from '@slack/bolt';
import { SummaryFeedback } from './summary-feedback';

export const Summary = ({
  actionId,
  basicText,
  summaryParts,
}: {
  actionId: string;
  basicText: string;
  summaryParts: string[];
}): (KnownBlock | Block)[] => {
  return [
    {
      type: 'section',
      text: {
        text: basicText,
        type: 'mrkdwn',
        verbatim: true,
      },
    },
    ...summaryParts.map((sp) => {
      return {
        type: 'section',
        text: {
          text: sp,
          type: 'plain_text',
          emoji: true,
        },
      };
    }),
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'plain_text',
        text: 'How was this summary?',
      },
      accessory: SummaryFeedback(actionId),
    },
  ];
};
