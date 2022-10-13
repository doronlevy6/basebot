import { Block, KnownBlock } from '@slack/bolt';
import { SummaryActions } from './summary-actions';
import { SummaryFeedback } from './summary-feedback';
import { UserLink } from './user-link';
import { SlackDate } from './date';
import { splitTextBlocks } from '../utils';
import { GeneratedByAIBlock } from './generated-by-ai';

interface Input {
  actionIds: {
    feedback: string;
    post: string;
    addToChannels: string;
  };
  cacheKey: string;
  userId: string;
  startTimeStamp: number;
  summary: string;
  isThread: boolean;
}

export const EphemeralSummary = ({
  actionIds,
  summary,
  startTimeStamp,
  userId,
  cacheKey,
  isThread,
}: Input): { title: string; blocks: (KnownBlock | Block)[] } => {
  const title = summaryTitle(userId, startTimeStamp, isThread);
  const fullText = `${title}\n${summary}`;
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
        postAction: { id: actionIds.post, value: cacheKey },
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

const summaryTitle = (
  userId: string,
  startTimeStamp: number,
  isThread: boolean,
) => {
  if (isThread) {
    return `*${UserLink(userId)} here's your summary:*`;
  }
  return `*${UserLink(userId)} here's your summary from \`${SlackDate(
    startTimeStamp.toString(),
  )}\` onwards:*`;
};
