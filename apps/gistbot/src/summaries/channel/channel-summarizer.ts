import { logger } from '@base/logger';
import { RespondFn } from '@slack/bolt';
import { KnownBlock, WebClient } from '@slack/web-api';
import { AnalyticsManager } from '@base/gistbot-shared';
import { Feature } from '../../feature-rate-limiter/limits';
import { FeatureRateLimiter } from '../../feature-rate-limiter/rate-limiter';
import { Routes } from '../../routes/router';
import { EphemeralSummary } from '../../slack/components/ephemeral-summary';
import { GoPro, GoProText } from '../../slack/components/go-pro';
import { responder } from '../../slack/responder';
import { stringifyMoreTimeProps } from '../channel-summary-more-time';
import { ModerationError } from '../errors/moderation-error';
import { RateLimitedError } from '../errors/rate-limited-error';
import { ChannelSummaryModel } from '../models/channel-summary.model';
import {
  approximatePromptCharacterCountForChannelSummary,
  MAX_PROMPT_CHARACTER_COUNT,
} from '../models/prompt-character-calculator';
import { SessionDataStore } from '../session-data/session-data-store';
import { SummaryStore } from '../summary-store';
import {
  ChannelSummarizationProps,
  ChannelSummaryContext,
  SlackMessage,
} from '../types';
import {
  enrichWithReplies,
  filterUnwantedMessages,
  genericErrorMessage,
  parseThreadForSummary,
  sortSlackMessages,
} from '../utils';
import { IReporter } from '@base/metrics';
import { formatSummary } from '../../slack/summary-formatter';
import { NoMessagesError } from '../errors/no-messages-error';

export const MAX_MESSAGES_TO_FETCH = 100;

export const DEFAULT_DAYS_BACK = 1;

export class ChannelSummarizer {
  constructor(
    private channelSummaryModel: ChannelSummaryModel,
    private analyticsManager: AnalyticsManager,
    private summaryStore: SummaryStore,
    private sessionDataStore: SessionDataStore,
    private metricsReporter: IReporter,
    private featureRateLimiter: FeatureRateLimiter,
  ) {}

  async summarize(
    summaryContext: ChannelSummaryContext,
    myBotId: string,
    teamId: string,
    userId: string,
    props: ChannelSummarizationProps,
    daysBack: number,
    client: WebClient,
    respond?: RespondFn,
    excludedMessage?: string,
  ): Promise<void> {
    try {
      const limited = await this.featureRateLimiter.acquire(
        { teamId: teamId, userId: userId },
        Feature.SUMMARY,
      );
      if (!limited) {
        throw new RateLimitedError('rate limited');
      }

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
        excludedMessage,
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
        const blocks: KnownBlock[] = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: text,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Summarize the last week',
                  emoji: true,
                },
                style: 'primary',
                value: stringifyMoreTimeProps(props, excludedMessage || ''),
                action_id: Routes.SUMMARIZE_CHANNEL_MORE_TIME,
              },
            ],
          },
        ];
        await responder(
          respond,
          client,
          text,
          summaryContext === 'request_more_time' ? undefined : blocks, // Only show the blocks if we are not in the 'request more time' context, so we don't show another CTA that won't do anything
          props.channelId,
          userId,
          { response_type: 'ephemeral' },
        );

        // If we were unable to get enough messages then we return a budget to the user
        this.featureRateLimiter
          .allowMore({ teamId: teamId, userId: userId }, Feature.SUMMARY, 1)
          .catch((e) =>
            logger.error({
              msg: `failed to allow more limit for channel summary on ${teamId}_${userId}`,
              error: e,
            }),
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
              reactions: t.reactions,
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
                reactions: t.reactions,
              };
            }),
          };
          cc = approximatePromptCharacterCountForChannelSummary(req);
        }

        const didFilter = threads.length < rootMessages.length;
        if (didFilter) {
          logger.info(
            `Filtered ${
              rootMessages.length - threads.length
            } threads to avoid hitting the character limit`,
          );
        }
        const summary = await this.channelSummaryModel.summarizeChannel(
          req,
          userId,
        );

        if (summary.summary_by_threads.length) {
          successfulSummary = formatSummary(
            summary.summary_by_threads,
            summary.titles,
            false,
          );
          break;
        }

        analyticsPrefix = 'redo_';
        threads.shift();
        if (threads.length === 0) {
          break;
        }
      }

      if (!successfulSummary.length) {
        throw new NoMessagesError('Invalid response');
      }

      const startTimeStamp = Number(rootMessages[0].ts);
      const { key: cacheKey } = await this.summaryStore.set({
        text: successfulSummary,
        startDate: startTimeStamp,
      });

      logger.info('Saved summary with cache key ' + cacheKey);

      // Don't fail if we can't store session data, we still have the summary and can send it back to the user
      try {
        await this.sessionDataStore.storeSession(cacheKey, {
          summaryType: 'channel',
          teamId: teamId,
          channelId: props.channelId,
          requestingUserId: userId,
          request: {
            channel_name: props.channelName,
            threads: threads.map((t) => {
              return {
                messageIds: t.messageIds,
                userIds: t.userIds,
                reactions: t.reactions,
              };
            }),
          },
          response: successfulSummary,
        });
      } catch (error) {
        logger.error({
          msg: `error in storing session for session ${cacheKey}`,
          error: error,
        });
      }

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
      // Checking the rate limit should be first. If the error is a rate limit error then we
      // prompt the user to "go pro" and pay for a subscription.
      if (error instanceof RateLimitedError) {
        logger.info('User had been rate limited');
        await responder(
          respond,
          client,
          GoProText,
          GoPro(),
          props.channelId,
          userId,
          {
            response_type: 'ephemeral',
          },
        );

        this.analyticsManager.channelSummaryFunnel({
          funnelStep: 'rate_limited',
          slackTeamId: teamId,
          slackUserId: userId,
          channelId: props.channelId,
          extraParams: {
            summaryContext: summaryContext,
          },
        });
        return;
      }

      logger.error(`error in channel summarizer: ${error} ${error.stack}`);

      // Every error other than rate limit errors should give the user back the request on their budget.
      // If there are errors that we want to not give the user back a budget on, then they should be before
      // this line.
      this.featureRateLimiter
        .allowMore({ teamId: teamId, userId: userId }, Feature.SUMMARY, 1)
        .catch((e) =>
          logger.error({
            msg: `failed to allow more limit for channel summary on ${teamId}_${userId}`,
            error: e,
          }),
        );

      if (error instanceof NoMessagesError) {
        const text =
          "Unfortunately we couldn't process a summarization on these messages at the moment, but we are adding more and more capabilities and languages every day. If you'd like to request something specific feel free to reach out to us at support@thegist.ai";
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
          funnelStep: 'no_messages_after_processing',
          slackTeamId: teamId,
          slackUserId: userId,
          channelId: props.channelId,
          extraParams: {
            summaryContext: summaryContext,
          },
        });
        return;
      }

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

      this.metricsReporter.error(
        'channel summarizer',
        'summarization-processing',
      );

      this.analyticsManager.error({
        slackTeamId: teamId,
        slackUserId: userId,
        channelId: props.channelId,
        errorMessage: error.message,
      });

      await genericErrorMessage(
        userId,
        props.channelId,
        client,
        undefined,
        respond,
      );
    }
  }

  async fetchChannelRootMessages(
    client: WebClient,
    channel_id: string,
    myBotId: string,
    maximumMessageCount: number,
    daysBack: number,
    userTz?: string,
    excludedMessage?: string,
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

        // Exclude any specifically excluded messages (like the mention that triggered us)
        if (m.ts && excludedMessage && excludedMessage === m.ts) {
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
}
