import { Block, KnownBlock } from '@slack/bolt';
import { SummaryFeedback } from './summary-feedback';

export const Summary = ({
  actionId,
  basicText,
  summary,
}: {
  actionId: string;
  basicText: string;
  summary: string;
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
    {
      type: 'section',
      text: {
        text: summary,
        type: 'plain_text',
        emoji: true,
      },
    },
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
