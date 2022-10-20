import { logger } from '@base/logger';
import { RespondFn } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '../../analytics/manager';
import { Routes } from '../../routes/router';
import { EphemeralSummary } from '../../slack/components/ephemeral-summary';
import { responder } from '../../slack/responder';
import { isBaseTeamWorkspace, isItayOnLenny } from '../../slack/utils';
import { ModerationError } from '../errors/moderation-error';
import {
  ChannelSummary,
  ChannelSummaryModel,
} from '../models/channel-summary.model';
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

export const DEFAULT_DAYS_BACK = 1;

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
    daysBack: number,
    client: WebClient,
    respond?: RespondFn,
  ): Promise<void> {
    try {
      const {
        error: infoError,
        ok: infoOk,
        user: userInfo,
      } = await client.users.info({
        user: userId,
      });
      if (infoError || !infoOk) {
        throw new Error(
          `Failed to fetch user from slack when trying to summarize a channel ${infoError}`,
        );
      }

      if (!userInfo) {
        throw new Error(
          `Failed to fetch user from slack when trying to summarize a channel, user not found`,
        );
      }

      const rootMessages = await this.fetchChannelRootMessages(
        client,
        props.channelId,
        myBotId,
        MAX_MESSAGES_TO_FETCH,
        daysBack,
        userInfo.tz,
      );

      if (rootMessages.length === 0) {
        this.analyticsManager.channelSummaryFunnel({
          funnelStep: `channel_too_small`,
          slackTeamId: teamId,
          slackUserId: userId,
          channelId: props.channelId,
          extraParams: {
            summaryContext: summaryContext,
          },
        });

        const text = `This channel does not have any messages in the last ${daysBack} day${
          daysBack > 1 ? 's' : ''
        }, so we cannot currently create a summary.`;
        await responder(
          respond,
          client,
          text,
          undefined,
          props.channelId,
          userId,
          { response_type: 'ephemeral' },
        );

        return;
      }

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

        const selectedSummary = await this.selectSummaryFromResponse(
          summary,
          userId,
          teamId,
        );

        if (selectedSummary.length) {
          successfulSummary = selectedSummary;
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

      await responder(respond, client, title, blocks, props.channelId, userId, {
        response_type: 'ephemeral',
      });

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
        const text =
          "This summary seems to be inappropriate :speak_no_evil:\nI'm not able to help you in this case.";
        await responder(
          respond,
          client,
          text,
          undefined,
          props.channelId,
          userId,
          {
            response_type: 'ephemeral',
          },
        );

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

      const text = `We had an error processing the summarization: ${error.message}`;
      await responder(
        respond,
        client,
        text,
        undefined,
        props.channelId,
        userId,
        {
          response_type: 'ephemeral',
        },
      );

      this.analyticsManager.error({
        slackTeamId: teamId,
        slackUserId: userId,
        channelId: props.channelId,
        errorMessage: error.message,
      });
    }
  }

  async fetchChannelRootMessages(
    client: WebClient,
    channel_id: string,
    myBotId: string,
    maximumMessageCount: number,
    daysBack: number,
    userTz?: string,
  ): Promise<SlackMessage[]> {
    const oldestMessageDateToFetch = this.getOldestMessagesDateToFetch(
      userTz || 'UTC',
      daysBack,
    ).toFixed(6);

    const output: SlackMessage[] = [];
    let cursor = '';

    while (output.length < maximumMessageCount) {
      // latest is time now or oldest message from the pagination
      const latestMsgDate = output.length
        ? output[output.length - 1].ts
        : (new Date().getTime() / 1000).toFixed(6);

      const { ok, error, messages, has_more, response_metadata } =
        await client.conversations.history({
          channel: channel_id,
          limit: maximumMessageCount - output.length,
          cursor: cursor,
          oldest: oldestMessageDateToFetch,
          latest: latestMsgDate,
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

  private getOldestMessagesDateToFetch(userTimezone: string, daysBack: number) {
    const dateWithTz = new Date(
      new Date().toLocaleString('en-US', { timeZone: userTimezone }),
    );
    const prevDate = new Date(
      dateWithTz.getFullYear(),
      dateWithTz.getMonth(),
      dateWithTz.getDate() - daysBack,
      0,
      0,
    );
    return prevDate.getTime() / 1000;
  }

  private async selectSummaryFromResponse(
    summary: ChannelSummary,
    userId: string,
    teamId: string,
  ): Promise<string> {
    if (summary.summary_by_topics === 'TBD') {
      summary.summary_by_topics = {};
    }

    let summaryByTopics = '';
    for (const key in summary.summary_by_topics) {
      if (
        Object.prototype.hasOwnProperty.call(summary.summary_by_topics, key)
      ) {
        const element = summary.summary_by_topics[key];
        summaryByTopics = `${summaryByTopics}${key}:\n${element}\n`;
      }
    }
    const summaryByBulletsFormatted = summary.summary_by_bullets
      .map((s, i) => `${i + 1}. ${s}`)
      .join('\n\n');

    if (isBaseTeamWorkspace(teamId) || isItayOnLenny(userId, teamId)) {
      return `*Summary By Everything*:\n${summary.summary_by_everything}\n\n*Summary By Bullets*:\n${summaryByBulletsFormatted}\n\n*Summary By Summary*:\n${summary.summary_by_summary}\n\n*Summary By Topics*:\n${summaryByTopics}\n\n`;
    }

    if (summary.summary_by_everything) {
      return summary.summary_by_everything;
    }

    if (summary.summary_by_topics) {
      return summaryByTopics;
    }

    if (summary.summary_by_bullets) {
      return summaryByBulletsFormatted;
    }

    if (summary.summary_by_summary) {
      return summary.summary_by_summary;
    }

    return '';
  }
}
