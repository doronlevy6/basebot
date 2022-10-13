import { logger } from '@base/logger';
import { RespondFn } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '../../analytics/manager';
import { Routes } from '../../routes/router';
import { EphemeralSummary } from '../../slack/components/ephemeral-summary';
import { ModerationError } from '../errors/moderation-error';
import { ChannelSummaryModel } from '../models/channel-summary.model';
import {
  approximatePromptCharacterCountForChannelSummary,
  MAX_PROMPT_CHARACTER_COUNT,
} from '../models/prompt-character-calculator';
import { SummaryStore } from '../summary-store';
import { ChannelSummarizationProps, SlackMessage } from '../types';
import {
  enrichWithReplies,
  filterUnwantedMessages,
  parseThreadForSummary,
  sortSlackMessages,
} from '../utils';

const MAX_MESSAGES_TO_FETCH = 50;

export class ChannelSummarizer {
  constructor(
    private channelSummaryModel: ChannelSummaryModel,
    private analyticsManager: AnalyticsManager,
    private summaryStore: SummaryStore,
  ) {}

  async summarize(
    summaryContext: string,
    myBotId: string,
    teamId: string,
    userId: string,
    props: ChannelSummarizationProps,
    client: WebClient,
    respond?: RespondFn,
    minMessageCount?: number,
  ): Promise<void> {
    try {
      const rootMessages = await this.fetchChannelRootMessages(
        client,
        props.channelId,
        myBotId,
        MAX_MESSAGES_TO_FETCH,
      );

      // Ensure that we sort the messages oldest first (so that the model receives a conversation in order)
      rootMessages.sort(sortSlackMessages);

      const messagesWithReplies = await enrichWithReplies(
        props.channelId,
        rootMessages,
        client,
        myBotId,
      );

      const threads = await Promise.all(
        messagesWithReplies.map((mwr) => {
          const thread = parseThreadForSummary(
            [mwr.message, ...mwr.replies],
            client,
            teamId,
            MAX_PROMPT_CHARACTER_COUNT,
            props.channelName,
            myBotId,
          );

          return thread;
        }),
      );

      const numberOfMessages = threads.reduce((acc, t) => {
        return acc + t.messages.length;
      }, 0);
      const numberOfUsers = threads.reduce((acc, t) => {
        return acc + t.users.length;
      }, 0);
      const uniqueUsers = threads.reduce((acc, t) => {
        t.users.forEach((u) => acc.add(u));
        return acc;
      }, new Set<string>());

      if (minMessageCount && numberOfMessages < minMessageCount) {
        logger.info(
          `${numberOfMessages} messages in channel ${props.channelId} less than the minimum requested count ${minMessageCount}`,
        );
        this.analyticsManager.channelSummaryFunnel({
          funnelStep: 'channel_too_small',
          slackTeamId: teamId,
          slackUserId: userId,
          channelId: props.channelId,
          extraParams: {
            summaryContext: summaryContext,
            numberOfThreads: threads.length,
            numberOfMessages: numberOfMessages,
            numberOfUsers: numberOfUsers,
            numberOfUniqueUsers: uniqueUsers.size,
          },
        });
        return;
      }

      let successfulSummary = '';
      let analyticsPrefix = '';
      // eslint-disable-next-line no-constant-condition
      while (true) {
        logger.info(
          `Attempting to summarize channel with ${threads.length} threads, ${numberOfMessages} messages, and ${numberOfUsers} users`,
        );

        this.analyticsManager.channelSummaryFunnel({
          funnelStep: `${analyticsPrefix}requesting_from_api`,
          slackTeamId: teamId,
          slackUserId: userId,
          channelId: props.channelId,
          extraParams: {
            summaryContext: summaryContext,
            numberOfThreads: threads.length,
            numberOfMessages: numberOfMessages,
            numberOfUsers: numberOfUsers,
            numberOfUniqueUsers: uniqueUsers.size,
          },
        });

        let req = {
          channel_name: props.channelName,
          threads: threads.map((t) => {
            return {
              messages: t.messages,
              names: t.users,
              titles: t.titles,
            };
          }),
        };
        let cc = approximatePromptCharacterCountForChannelSummary(req);
        while (cc > MAX_PROMPT_CHARACTER_COUNT) {
          threads.shift();
          req = {
            channel_name: props.channelName,
            threads: threads.map((t) => {
              return {
                messages: t.messages,
                names: t.users,
                titles: t.titles,
              };
            }),
          };
          cc = approximatePromptCharacterCountForChannelSummary(req);
        }

        const summary = await this.channelSummaryModel.summarizeChannel(
          req,
          userId,
        );

        if (summary.length) {
          successfulSummary = summary;
          break;
        }

        analyticsPrefix = 'redo_';
        threads.shift();
        if (threads.length === 0) {
          break;
        }
      }

      if (!successfulSummary.length) {
        throw new Error('Invalid response');
      }

      const startTimeStamp = Number(rootMessages[0].ts);
      const { key: cacheKey } = await this.summaryStore.set({
        text: successfulSummary,
        startDate: startTimeStamp,
      });

      logger.info('Saved summary with cache key ' + cacheKey);

      const { blocks, title } = EphemeralSummary({
        actionIds: {
          feedback: Routes.CHANNEL_SUMMARY_FEEDBACK,
          addToChannels: Routes.ADD_TO_CHANNEL_FROM_WELCOME_MODAL,
          post: Routes.CHANNEL_SUMMARY_POST,
        },
        cacheKey,
        startTimeStamp,
        userId,
        summary: successfulSummary,
        isThread: false,
      });

      if (respond) {
        await respond({
          response_type: 'ephemeral',
          text: title,
          blocks,
        });
      } else {
        await client.chat.postEphemeral({
          text: title,
          blocks,
          channel: props.channelId,
          user: userId,
        });
      }

      this.analyticsManager.channelSummaryFunnel({
        funnelStep: 'summarized',
        slackTeamId: teamId,
        slackUserId: userId,
        channelId: props.channelId,
        extraParams: {
          summaryContext: summaryContext,
          numberOfThreads: threads.length,
          numberOfMessages: numberOfMessages,
          numberOfUsers: numberOfUsers,
          numberOfUniqueUsers: uniqueUsers.size,
        },
      });
    } catch (error) {
      logger.error(`error in channel summarizer: ${error} ${error.stack}`);
      if (error instanceof ModerationError) {
        if (respond) {
          await respond({
            response_type: 'ephemeral',
            text: "This summary seems to be inappropriate :speak_no_evil:\nI'm not able to help you in this case.",
          });
        } else {
          await client.chat.postEphemeral({
            text: "This summary seems to be inappropriate :speak_no_evil:\nI'm not able to help you in this case.",
            channel: props.channelId,
            user: userId,
          });
        }

        this.analyticsManager.channelSummaryFunnel({
          funnelStep: 'moderated',
          slackTeamId: teamId,
          slackUserId: userId,
          channelId: props.channelId,
          extraParams: {
            summaryContext: summaryContext,
          },
        });
        return;
      }

      if (respond) {
        await respond({
          response_type: 'ephemeral',
          text: `We had an error processing the summarization: ${error.message}`,
        });
      } else {
        await client.chat.postEphemeral({
          text: `We had an error processing the summarization: ${error.message}`,
          channel: props.channelId,
          user: userId,
        });
      }

      this.analyticsManager.error({
        slackTeamId: teamId,
        slackUserId: userId,
        channelId: props.channelId,
        errorMessage: error.message,
      });
    }
  }

  private async fetchChannelRootMessages(
    client: WebClient,
    channel_id: string,
    myBotId: string,
    maximumMessageCount: number,
  ): Promise<SlackMessage[]> {
    const output: SlackMessage[] = [];
    let cursor = '';

    while (output.length < maximumMessageCount) {
      const { ok, error, messages, has_more, response_metadata } =
        await client.conversations.history({
          channel: channel_id,
          limit: maximumMessageCount - output.length,
          cursor: cursor,
        });

      if (error || !ok) {
        throw new Error(`conversation history error: ${error} ${ok}`);
      }

      if (!messages) {
        break;
      }

      const filteredMessages = messages.filter((m) => {
        // conversations.history returns some messages in threads
        // and since we are going to fetch the replies anyways, we should
        // remove these from the roots.
        if (m.thread_ts && m.ts !== m.thread_ts) {
          return false;
        }

        return filterUnwantedMessages(m, myBotId);
      });

      output.push(...filteredMessages);

      cursor = response_metadata?.next_cursor || '';
      if (!has_more || cursor === '') {
        break;
      }
    }

    return output;
  }
}
