import { logger } from '@base/logger';
import { RespondFn } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '@base/gistbot-shared';
import { Feature } from '../../feature-rate-limiter/limits';
import { FeatureRateLimiter } from '../../feature-rate-limiter/rate-limiter';
import { Routes } from '../../routes/router';
import { EphemeralSummary } from '../../slack/components/ephemeral-summary';
import { GoPro, GoProText } from '../../slack/components/go-pro';
import { responder } from '../../slack/responder';
import { ModerationError } from '../errors/moderation-error';
import { RateLimitedError } from '../errors/rate-limited-error';
import { SessionDataStore } from '../session-data/session-data-store';
import { SummaryStore } from '../summary-store';
import { ThreadSummarizationProps } from '../types';
import { genericErrorMessage } from '../utils';
import { IReporter } from '@base/metrics';
import { MessagesSummarizer } from '../messages/messages-summarizer';
import { generateIDAsync } from '../../utils/id-generator.util';
import { NoMessagesError } from '../errors/no-messages-error';

export class ThreadSummarizer {
  constructor(
    private messagesSummarizer: MessagesSummarizer,
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
    const sessionId = await generateIDAsync();
    try {
      const limited = await this.featureRateLimiter.acquire(
        { teamId: teamId, userId: userId },
        Feature.SUMMARY,
      );
      if (!limited) {
        throw new RateLimitedError('rate limited');
      }

      const { ok, error, messages } = await client.conversations.history({
        channel: props.channelId,
        limit: 1,
        oldest: props.threadTs,
        inclusive: true,
      });

      if (error || !ok) {
        throw new Error(
          `error in fetching root message from conversation: ${error} ${ok}`,
        );
      }

      if (!messages || messages.length === 0) {
        throw new Error(
          `error in fetching root message from conversation: no messages found`,
        );
      }

      if (messages[0].ts !== props.threadTs) {
        throw new Error(
          `received unexpected ts from conversation: expected=${props.threadTs}; got=${messages[0].ts}`,
        );
      }

      this.analyticsManager.threadSummaryFunnel({
        funnelStep: 'requesting_from_api',
        slackTeamId: teamId,
        slackUserId: userId,
        channelId: props.channelId,
        threadTs: props.threadTs,
        extraParams: {
          gist_session: sessionId,
        },
      });

      const summarization = await this.messagesSummarizer.summarize(
        'thread',
        sessionId,
        [messages[0]],
        userId,
        teamId,
        props.channelId,
        props.channelName,
        myBotId,
        client,
      );

      this.analyticsManager.threadSummaryFunnel({
        funnelStep: 'completed_requesting_from_api',
        slackTeamId: teamId,
        slackUserId: userId,
        channelId: props.channelId,
        threadTs: props.threadTs,
        extraParams: {
          numberOfMessages: summarization.numberOfMessages,
          numberOfUsers: summarization.numberOfUsers,
          numberOfUniqueUsers: summarization.uniqueUsers,
          gist_session: sessionId,
        },
      });

      if (summarization.singleBotChannelDetected) {
        this.analyticsManager.channelSummaryFunnel({
          funnelStep: 'bot_summarized',
          channelId: props.channelId,
          slackTeamId: teamId,
          slackUserId: userId,
          extraParams: {
            botName: summarization.botName,
            numberOfMessages: summarization.numberOfMessages,
          },
        });
      }

      const startTimeStamp = Number(props.threadTs);
      await this.summaryStore.set(
        {
          text: summarization.summary,
          startDate: startTimeStamp,
          threadTs: props.threadTs,
        },
        sessionId,
      );

      const { blocks, title } = EphemeralSummary({
        actionIds: {
          feedback: Routes.THREAD_SUMMARY_FEEDBACK,
          addToChannels: Routes.ADD_TO_CHANNEL_FROM_WELCOME_MODAL,
          post: Routes.THREAD_SUMMARY_POST,
        },
        cacheKey: sessionId,
        userId,
        startTimeStamp,
        summary: summarization.summary,
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
          numberOfMessages: summarization.numberOfMessages,
          numberOfUsers: summarization.numberOfUsers,
          numberOfUniqueUsers: summarization.uniqueUsers,
          gist_session: sessionId,
        },
      });
    } catch (error) {
      // Checking the rate limit should be first. If the error is a rate limit error then we
      // prompt the user to "go pro" and pay for a subscription.
      if (error instanceof RateLimitedError) {
        logger.info(`User has been rate limited`);
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
          extraParams: {
            gist_session: sessionId,
          },
        });
        return;
      }

      logger.error(`error in thread summarizer: ${error}`);

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
          props.threadTs,
        );

        this.analyticsManager.threadSummaryFunnel({
          funnelStep: 'no_messages_after_processing',
          slackTeamId: teamId,
          slackUserId: userId,
          channelId: props.channelId,
          threadTs: props.threadTs,
        });
        return;
      }

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
          extraParams: {
            gist_session: sessionId,
          },
        });
        return;
      }

      this.metricsReporter.error(
        'thread summarizer',
        'summarization-processing',
        teamId,
      );

      this.analyticsManager.error({
        slackTeamId: teamId,
        slackUserId: userId,
        channelId: props.channelId,
        errorMessage: error.message,
        extraParams: {
          threadTs: props.threadTs,
          gist_session: sessionId,
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
