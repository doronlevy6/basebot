import { logger } from '@base/logger';
import { RespondFn } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '../../analytics/manager';
import { Feature } from '../../feature-rate-limiter/limits';
import { FeatureRateLimiter } from '../../feature-rate-limiter/rate-limiter';
import { Routes } from '../../routes/router';
import { EphemeralSummary } from '../../slack/components/ephemeral-summary';
import { GoPro, GoProText } from '../../slack/components/go-pro';
import { responder } from '../../slack/responder';
import { ModerationError } from '../errors/moderation-error';
import { RateLimitedError } from '../errors/rate-limited-error';
import { MAX_PROMPT_CHARACTER_COUNT } from '../models/prompt-character-calculator';
import { ThreadSummaryModel } from '../models/thread-summary.model';
import { SessionDataStore } from '../session-data/session-data-store';
import { SummaryStore } from '../summary-store';
import { SlackMessage, ThreadSummarizationProps } from '../types';
import {
  filterUnwantedMessages,
  genericErrorMessage,
  parseThreadForSummary,
} from '../utils';
import { IReporter } from '@base/metrics';

export class ThreadSummarizer {
  constructor(
    private threadSummaryModel: ThreadSummaryModel,
    private analyticsManager: AnalyticsManager,
    private summaryStore: SummaryStore,
    private sessionDataStore: SessionDataStore,
    private metricsReporter: IReporter,
    private featureRateLimiter: FeatureRateLimiter,
  ) {}

  async summarize(
    myBotId: string,
    teamId: string,
    userId: string,
    props: ThreadSummarizationProps,
    client: WebClient,
    respond?: RespondFn,
  ): Promise<void> {
    try {
      const limited = await this.featureRateLimiter.acquire(
        { teamId: teamId, userId: userId },
        Feature.SUMMARY,
      );
      if (!limited) {
        throw new RateLimitedError('rate limited');
      }

      const messageReplies: SlackMessage[] = [];

      // eslint-disable-next-line no-constant-condition
      while (true) {
        let cursor = '';
        const messageRepliesRes = await client.conversations.replies({
          channel: props.channelId,
          ts: props.threadTs,
          limit: 200,
          cursor: cursor,
        });

        if (messageRepliesRes.error) {
          throw new Error(`message replies error: ${messageRepliesRes.error}`);
        }
        if (!messageRepliesRes.ok) {
          throw new Error('message replies not ok');
        }

        if (!messageRepliesRes.messages) {
          break;
        }

        messageReplies.push(
          ...messageRepliesRes.messages.filter((m) => {
            return filterUnwantedMessages(m, myBotId);
          }),
        );

        if (!messageRepliesRes.has_more) {
          break;
        }

        if (!messageRepliesRes.response_metadata?.next_cursor) {
          break;
        }
        cursor = messageRepliesRes.response_metadata.next_cursor;
      }

      const {
        messages: messagesTexts,
        users,
        titles,
        messageIds,
        userIds,
        reactions,
      } = await parseThreadForSummary(
        [...messageReplies],
        client,
        teamId,
        MAX_PROMPT_CHARACTER_COUNT,
        props.channelName,
        myBotId,
      );

      logger.info(
        `Attempting to summarize thread with ${messagesTexts.length} messages and ${users.length} users`,
      );

      this.analyticsManager.threadSummaryFunnel({
        funnelStep: 'requesting_from_api',
        slackTeamId: teamId,
        slackUserId: userId,
        channelId: props.channelId,
        threadTs: props.threadTs,
        extraParams: {
          numberOfMessages: messagesTexts.length,
          numberOfUsers: users.length,
          numberOfUniqueUsers: new Set(users).size,
        },
      });

      const summary = await this.threadSummaryModel.summarizeThread(
        {
          messages: messagesTexts,
          names: users,
          titles: titles,
          channel_name: props.channelName,
          reactions: reactions,
        },
        userId,
      );

      if (!summary.length) {
        throw new Error('Invalid response');
      }

      const startTimeStamp = Number(props.threadTs);
      const { key } = await this.summaryStore.set({
        text: summary,
        startDate: startTimeStamp,
        threadTs: props.threadTs,
      });

      // Don't fail if we can't store session data, we still have the summary and can send it back to the user
      try {
        await this.sessionDataStore.storeSession(key, {
          summaryType: 'thread',
          teamId: teamId,
          channelId: props.channelId,
          requestingUserId: userId,
          threadTs: props.threadTs,
          request: {
            channel_name: props.channelName,
            messageIds: messageIds,
            userIds: userIds,
            reactions: reactions,
          },
          response: summary,
        });
      } catch (error) {
        logger.error({
          msg: `error in storing session for session ${key}`,
          error: error,
        });
      }

      const { blocks, title } = EphemeralSummary({
        actionIds: {
          feedback: Routes.THREAD_SUMMARY_FEEDBACK,
          addToChannels: Routes.ADD_TO_CHANNEL_FROM_WELCOME_MODAL,
          post: Routes.THREAD_SUMMARY_POST,
        },
        cacheKey: key,
        userId,
        startTimeStamp,
        summary,
        isThread: true,
      });

      // Slack's API does not work with respond ephemeral in threads, they reccomend to not use respond in this cases and just use this.
      await client.chat.postEphemeral({
        channel: props.channelId,
        thread_ts: props.threadTs,
        user: userId,
        blocks,
        text: title,
      });

      this.analyticsManager.threadSummaryFunnel({
        funnelStep: 'summarized',
        slackTeamId: teamId,
        slackUserId: userId,
        channelId: props.channelId,
        threadTs: props.threadTs,
        extraParams: {
          numberOfMessages: messagesTexts.length,
          numberOfUsers: users.length,
          numberOfUniqueUsers: new Set(users).size,
        },
      });
    } catch (error) {
      logger.error(`error in thread summarizer: ${error}`);

      // Checking the rate limit should be first. If the error is a rate limit error then we
      // prompt the user to "go pro" and pay for a subscription.
      if (error instanceof RateLimitedError) {
        await responder(
          undefined, // Thread ephemeral messages with the respond func don't work correctly so we force undefined in the respond func
          client,
          GoProText,
          GoPro(),
          props.channelId,
          userId,
          {
            response_type: 'ephemeral',
          },
          props.threadTs,
        );

        this.analyticsManager.threadSummaryFunnel({
          funnelStep: 'rate_limited',
          slackTeamId: teamId,
          slackUserId: userId,
          channelId: props.channelId,
          threadTs: props.threadTs,
        });
        return;
      }

      // Every error other than rate limit errors should give the user back the request on their budget.
      // If there are errors that we want to not give the user back a budget on, then they should be before
      // this line.
      this.featureRateLimiter
        .allowMore({ teamId: teamId, userId: userId }, Feature.SUMMARY, 1)
        .catch((e) =>
          logger.error({
            msg: `failed to allow more limit for thread sumary on ${teamId}_${userId}`,
            error: e,
          }),
        );

      if (error instanceof ModerationError) {
        const text =
          "This summary seems to be inappropriate :speak_no_evil:\nI'm not able to help you in this case.";
        await responder(
          undefined, // Thread ephemeral messages with the respond func don't work correctly so we force undefined in the respond func
          client,
          text,
          undefined,
          props.channelId,
          userId,
          {
            response_type: 'ephemeral',
          },
          props.threadTs,
        );

        this.analyticsManager.threadSummaryFunnel({
          funnelStep: 'moderated',
          slackTeamId: teamId,
          slackUserId: userId,
          channelId: props.channelId,
          threadTs: props.threadTs,
        });
        return;
      }

      this.metricsReporter.error(
        'thread summarizer',
        'summarization-processing',
      );

      this.analyticsManager.error({
        slackTeamId: teamId,
        slackUserId: userId,
        channelId: props.channelId,
        errorMessage: error.message,
        extraParams: {
          threadTs: props.threadTs,
        },
      });

      await genericErrorMessage(
        userId,
        props.channelId,
        client,
        props.threadTs,
        respond,
      );
    }
  }
}
