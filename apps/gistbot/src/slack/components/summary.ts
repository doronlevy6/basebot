import { Block, KnownBlock } from '@slack/bolt';
import { splitTextBlocks } from '../utils';
import { SlackDate } from './date';
import { GeneratedByAIBlock } from './generated-by-ai';
import { SummaryActions } from './summary-actions';
import { SummaryFeedback } from './summary-feedback';
import { UserLink } from './user-link';

interface Input {
  actionIds: {
    feedback: string;
    addToChannels: string;
  };
  userId: string;
  startTimeStamp: number;
  summary: string;
  myBotUserId: string;
  isThread: boolean;
}

export const Summary = ({
  actionIds,
  summary,
  startTimeStamp,
  userId,
  myBotUserId,
  isThread,
}: Input): { title: string; blocks: (KnownBlock | Block)[] } => {
  const title = summaryTitle(startTimeStamp, isThread);

  const footer = `This summary was requested by ${UserLink(
    userId,
  )}. Get your summary at: ${UserLink(myBotUserId)}.`;

  const fullText = `${title}\n${summary}\n\n${footer}`;
  const blocksSplit = splitTextBlocks(fullText);
  return {
    title,
    blocks: [
      ...blocksSplit.map((text) => ({
        type: 'section',
        text: {
          text,
          type: 'mrkdwn',
        },
      })),
      SummaryActions({
        addToChannelsAction: { id: actionIds.addToChannels },
      }),
      GeneratedByAIBlock(),
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: 'How was this summary?',
        },
        accessory: SummaryFeedback(actionIds.feedback),
      },
    ],
  };
};

const summaryTitle = (startTimeStamp: number, isThread: boolean) => {
  if (isThread) {
    return `*Summary of this thread:*`;
  }
  return `*Summary of messages from \`${SlackDate(
    startTimeStamp.toString(),
  )}\` onwards:*`;
};
