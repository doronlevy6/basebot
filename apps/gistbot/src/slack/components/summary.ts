import { Block, KnownBlock } from '@slack/bolt';
import { SlackDate } from './date';
import { PublicGeneratedByAIBlock } from './generated-by-ai';
import { SummaryActions } from './summary-actions';
import { SummaryFeedback } from './summary-feedback';
import { SummaryTitleAndText } from './summary-title-and-text';

interface Input {
  actionIds: {
    feedback: string;
    addToChannels: string;
  };
  cacheKey: string;
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
  cacheKey,
  userId,
  myBotUserId,
  isThread,
}: Input): { title: string; blocks: (KnownBlock | Block)[] } => {
  const title = summaryTitle(startTimeStamp, isThread);

  return {
    title,
    blocks: [
      ...SummaryTitleAndText(title, summary),
      SummaryActions({
        addToChannelsAction: { id: actionIds.addToChannels },
      }),
      PublicGeneratedByAIBlock(userId, myBotUserId),
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: 'How was this summary?',
        },
        accessory: SummaryFeedback(actionIds.feedback, cacheKey),
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
