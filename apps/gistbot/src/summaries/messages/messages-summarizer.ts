import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { SlackMessage } from '../types';
import { enrichWithReplies, getUserOrBotDetails } from '../utils';
import {
  consolidateForRequest,
  parseModelMessage,
  PickedMessage,
} from './utils';
import {
  ConversationSummary,
  MessagesSummaryModel,
  MessagesSummaryRequest,
} from '../models/messages-summary.model';
import { formatConversationSummaries } from './formatter';
import { SessionDataStore } from '../session-data/session-data-store';
import { NoMessagesError } from '../errors/no-messages-error';
import { BotsManager } from '../../bots-integrations/bots-manager';
import { ChannelModelTranslator } from '../models/channel-model-translator';
import { ChannelSummaryModel } from '../models/channel-summary.model';
import { AllMessagesPrefilteredError } from '../errors/all-messages-filtered-error';
import { SlackDataStore } from '../../utils/slack-data-store';

export interface Summarization {
  summary: string;
  numberOfMessages: number;
  numberOfUsers: number;
  uniqueUsers: number;
  singleBotChannelDetected: false;
}

export interface SingleBotChannelSummarization {
  summary: string;
  numberOfMessages: number;
  numberOfUsers: 1;
  uniqueUsers: 1;
  singleBotChannelDetected: true;
  botName: string;
}

export type MessagesSummarizerContext = 'thread' | 'channel' | 'multi_channel';

export class MessagesSummarizer {
  constructor(
    private messagesSummaryModel: MessagesSummaryModel,
    private channelSummaryModel: ChannelSummaryModel,
    private translator: ChannelModelTranslator,
    private sessionDataStore: SessionDataStore,
    private botsManager: BotsManager,
    private slackDataStore: SlackDataStore,
    private readonly enableV3: boolean,
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
  ): Promise<Summarization | SingleBotChannelSummarization> {
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

    const botSummaries = this.botsManager.handleBots(flattenedMessages);
    const singleBotChannelSummary = botSummaries.find(
      (bs) => bs.detectedAsSingleBotChannel,
    );
    if (singleBotChannelSummary) {
      return {
        summary: singleBotChannelSummary.summary,
        numberOfMessages: singleBotChannelSummary.numberOfMessages,
        numberOfUsers: 1,
        uniqueUsers: 1,
        singleBotChannelDetected: true,
        botName: singleBotChannelSummary.botName,
      };
    }

    const pickedModelMessages = (
      await Promise.all(
        flattenedMessages.map((msg) =>
          parseModelMessage(
            msg,
            client,
            teamId,
            channelId,
            this.slackDataStore,
            myBotId,
          ),
        ),
      )
    ).filter((m) => m && m.text) as PickedMessage[]; // Filter should remove any undefineds but the typescript isn't picking that up so we force the cast...

    const userOrBotIds = pickedModelMessages.map((pm) => {
      return {
        is_bot: pm.is_bot,
        user_id: pm.user_id,
      };
    });

    const userOrBotDetails = await getUserOrBotDetails(
      [...new Map(userOrBotIds.map((item) => [item.user_id, item])).values()],
      teamId,
      client,
      this.slackDataStore,
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
      if (req.length === 0) {
        throw new AllMessagesPrefilteredError(
          `all messages pre-filtered before request, original size ${originalReq.length}`,
        );
      }

      const didFilter = req.length < originalReq.length;
      if (didFilter) {
        logger.info(
          `Filtered ${
            originalReq.length - req.length
          } threads to avoid hitting the character limit`,
        );
      }

      const summaries = await this.runModel(sessionId, req, requestingUserId);

      const channelSummaryAllEmpty = !summaries.some((summary) =>
        summary?.summary?.trim(),
      );

      if (summaries?.length == 0 || channelSummaryAllEmpty) {
        originalReq.shift();

        if (originalReq.length === 0) {
          break;
        }
        logger.error({
          msg: 'getting empty respones',
        });
      } else {
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
          singleBotChannelDetected: false,
        };
      }
    }

    // If we get here it means the loop never returns internally, so we've arrived at the end without a response
    throw new NoMessagesError('Invalid response');
  }

  private async runModel(
    sessionId: string,
    req: MessagesSummaryRequest,
    requestingUserId: string,
  ): Promise<ConversationSummary[]> {
    if (this.enableV3) {
      return await this.messagesSummaryModel.summarize(
        sessionId,
        req,
        requestingUserId,
      );
    }

    const v2Request = this.translator.translateRequestToV2(req);
    const v2Response = await this.channelSummaryModel.summarizeChannel(
      v2Request,
      requestingUserId,
    );
    return this.translator.translateResponseToV3(v2Response);
  }
}
