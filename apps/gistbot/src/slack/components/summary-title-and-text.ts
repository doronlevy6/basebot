import { SectionBlock } from '@slack/web-api';
import { splitTextBlocks } from '../utils';

export const SummaryTitleAndText = (
  title: string,
  summary: string,
): SectionBlock[] => {
  const blocksSplit = splitTextBlocks(summary);

  return [
    {
      type: 'section',
      text: {
        text: title,
        type: 'mrkdwn',
      },
    },
    ...blocksSplit.map(
      (text): SectionBlock => ({
        type: 'section',
        text: {
          text,
          type: 'mrkdwn',
        },
      }),
    ),
  ];
};
