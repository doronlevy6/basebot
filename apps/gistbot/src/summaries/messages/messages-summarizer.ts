import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import {
  approximatePromptCharacterCountForChannelSummaryModelMessages,
  MAX_PROMPT_CHARACTER_COUNT,
} from '../models/prompt-character-calculator';
import { SlackMessage } from '../types';
import { enrichWithReplies, getUserOrBotDetails } from '../utils';
import {
  consolidateForRequest,
  parseModelMessage,
  PickedMessage,
} from './utils';
import { MessagesSummaryModel } from '../models/messages-summary.model';
import { formatConversationSummaries } from './formatter';
import { SessionDataStore } from '../session-data/session-data-store';

export interface Summarization {
  summary: string;
  numberOfMessages: number;
  numberOfUsers: number;
  uniqueUsers: number;
}

export type MessagesSummarizerContext = 'thread' | 'channel' | 'multi_channel';

export class MessagesSummarizer {
  constructor(
    private messagesSummaryModel: MessagesSummaryModel,
    private sessionDataStore: SessionDataStore,
  ) {}

  async summarize(
    context: MessagesSummarizerContext,
    sessionId: string,
    rootMessages: SlackMessage[],
    requestingUserId: string,
    teamId: string,
    channelId: string,
    channelName: string,
    myBotId: string,
    client: WebClient,
  ): Promise<Summarization> {
    const messagesWithReplies = await enrichWithReplies(
      channelId,
      rootMessages,
      client,
      myBotId,
    );

    const flattenedMessages = messagesWithReplies.flatMap((mwr) => [
      mwr.message,
      ...mwr.replies,
    ]);

    const pickedModelMessages = (
      await Promise.all(
        flattenedMessages.map((msg) =>
          parseModelMessage(msg, client, teamId, channelId, myBotId),
        ),
      )
    ).filter((m) => m) as PickedMessage[]; // Filter should remove any undefineds but the typescript isn't picking that up so we force the cast...

    const userOrBotIds = pickedModelMessages.map((pm) => {
      return {
        is_bot: pm.is_bot,
        user_id: pm.user_id,
      };
    });

    const userOrBotDetails = await getUserOrBotDetails(
      [...new Set(userOrBotIds)],
      teamId,
      client,
    );

    const originalReq = consolidateForRequest(
      channelName,
      pickedModelMessages,
      userOrBotDetails,
    );

    const numberOfMessages = originalReq.length;
    const numberOfUsers = userOrBotIds.length;
    const uniqueUsers = userOrBotDetails.length;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      logger.info(
        `Attempting to summarize messages with ${numberOfMessages} messages, and ${numberOfUsers} users`,
      );

      const req = [...originalReq];
      let cc =
        approximatePromptCharacterCountForChannelSummaryModelMessages(req);
      while (cc > MAX_PROMPT_CHARACTER_COUNT) {
        req.shift();
        cc = approximatePromptCharacterCountForChannelSummaryModelMessages(req);
      }

      const didFilter = req.length < originalReq.length;
      if (didFilter) {
        logger.info(
          `Filtered ${
            originalReq.length - req.length
          } threads to avoid hitting the character limit`,
        );
      }
      const summaries = await this.messagesSummaryModel.summarize(
        req,
        requestingUserId,
      );

      if (summaries.length && summaries.length > 0) {
        const formattedSummary = await formatConversationSummaries(
          channelId,
          summaries,
          client,
          {
            addPermalinks: context !== 'thread',
          },
        );

        // Don't fail if we can't store session data, we still have the summary and can send it back to the user
        this.sessionDataStore
          .storeSession(sessionId, {
            summaryType: 'channel',
            teamId: teamId,
            channelId: channelId,
            requestingUserId: requestingUserId,
            messages: req,
            response: formattedSummary,
          })
          .catch((error) => {
            logger.error({
              msg: `error in storing session for session ${sessionId}`,
              error: error,
            });
          });

        return {
          summary: formattedSummary,
          numberOfMessages: numberOfMessages,
          numberOfUsers: numberOfUsers,
          uniqueUsers: uniqueUsers,
        };
      }

      req.shift();
      if (req.length === 0) {
        break;
      }
    }

    // If we get here it means the loop never returns internally, so we've arrived at the end without a response
    throw new Error('Invalid response');
  }
}
