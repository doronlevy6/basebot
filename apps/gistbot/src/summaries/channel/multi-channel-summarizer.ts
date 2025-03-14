import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '@base/gistbot-shared';
import { ChannelSummarizer, MAX_MESSAGES_TO_FETCH } from './channel-summarizer';
import {
  MultiChannelSummarizationProps,
  MultiChannelSummaryContext,
  SlackMessage,
} from '../types';
import { delay, retry } from '../../utils/retry';
import { ModerationError } from '../errors/moderation-error';
import { NoMessagesError } from '../errors/no-messages-error';
import { formatMultiChannelSummary } from '../../slack/summary-formatter';
import { MessagesSummarizer } from '../messages/messages-summarizer';
import { generateIDAsync } from '../../utils/id-generator.util';
import { SlackDataStore } from '../../utils/slack-data-store';
import { ChannelSummaryStore } from '../channel-summary-store';
import { IReporter } from '@base/metrics';

export type OutputError =
  | 'channel_too_small'
  | 'moderated'
  | 'general_error'
  | 'no_msg_error';

interface Summarization {
  channelId: string;
  channelName: string;
  rootMessages: SlackMessage[];
  error?: OutputError;
}

export interface OutputSummary {
  channelId: string;
  channelName: string;
  summary: string;
  error?: OutputError;
}

export interface MultiChannelSummarizerOutput {
  summaries: OutputSummary[];
  error?: OutputError;
}

export class MultiChannelSummarizer {
  constructor(
    private messagesSummarizer: MessagesSummarizer,
    private analyticsManager: AnalyticsManager,
    private channelSummarizer: ChannelSummarizer,
    private slackDataStore: SlackDataStore,
    private channelSummaryStore: ChannelSummaryStore,
    private metricsReporter: IReporter,
  ) {}

  async summarize(
    summaryContext: MultiChannelSummaryContext,
    myBotId: string,
    teamId: string,
    userId: string,
    props: MultiChannelSummarizationProps,
    client: WebClient,
    daysBack: number,
  ): Promise<MultiChannelSummarizerOutput> {
    const sessionId = await generateIDAsync();
    try {
      logger.info({
        msg: `starting multi-channel summary`,
        user: userId,
        team: teamId,
        channels: props.channels.map((c) => c.channelId),
      });
      const userInfo = await this.slackDataStore.getUserInfoData(
        userId,
        teamId,
        client,
      );
      const cachedSummaries = await Promise.all(
        props.channels.map((p) =>
          this.channelSummaryStore.get(p.channelId, teamId),
        ),
      );

      const cachedSummariesFiltered = cachedSummaries.filter(
        (element) => element !== null,
      ) as OutputSummary[];

      const channelsToSummarize = props.channels.filter(
        (channel) =>
          !cachedSummariesFiltered
            .map((cs) => cs.channelId)
            .includes(channel.channelId),
      );
      logger.debug(
        `cache miss for channel summary at keys: ${channelsToSummarize.map(
          (c) => c.channelId,
        )}`,
      );
      const channels: Summarization[] = await Promise.all(
        channelsToSummarize.map(async (c): Promise<Summarization> => {
          try {
            const result = await retry(
              async (): Promise<Summarization> => {
                const msgs =
                  await this.channelSummarizer.fetchChannelRootMessages(
                    client,
                    c.channelId,
                    myBotId,
                    MAX_MESSAGES_TO_FETCH,
                    daysBack,
                    userInfo.tz,
                  );

                if (msgs.length === 0) {
                  logger.info(
                    `no messages for channels ${c.channelId}|${c.channelName}`,
                  );
                  return {
                    channelId: c.channelId,
                    channelName: c.channelName,
                    rootMessages: [],
                    error: 'channel_too_small',
                  };
                }

                return {
                  channelId: c.channelId,
                  channelName: c.channelName,
                  rootMessages: msgs,
                };
              },
              {
                count: 10,
                id: `fetch_slack_messages_${teamId}_${userId}_${c.channelId}`,
              },
            );
            return result;
          } catch (error) {
            logger.error(
              `error in multi-channel summarizer during fetch root messages: ${error} ${error.stack}`,
            );

            return {
              channelId: c.channelId,
              channelName: c.channelName,
              rootMessages: [],
              error: 'general_error',
            };
          }
        }),
      );

      const newChannelSummaries = await Promise.all(
        channels.map((channel) =>
          this.summarizeChannel(
            sessionId,
            channel,
            myBotId,
            userId,
            teamId,
            client,
          ),
        ),
      );
      newChannelSummaries.map((summary) => {
        if (!summary.error) {
          return this.channelSummaryStore.set(
            summary,
            summary.channelId,
            teamId,
          );
        }
      });
      const result = [...newChannelSummaries, ...cachedSummariesFiltered];
      const ordered = props.channels.map((p) => p.channelId);
      result.sort(
        (a, b) => ordered.indexOf(a.channelId) - ordered.indexOf(b.channelId),
      );
      return {
        summaries: result,
      };
    } catch (error) {
      logger.error(
        `error in multi-channel summarizer: ${error} ${error.stack}`,
      );

      this.metricsReporter.error(
        'multi channel summary',
        'multi-channel-summary',
        teamId,
      );

      return { summaries: [], error: 'general_error' };
    }
  }

  private async summarizeChannel(
    sessionId: string,
    channel: Summarization,
    myBotId: string,
    userId: string,
    teamId: string,
    client: WebClient,
  ): Promise<OutputSummary> {
    if (channel.error) {
      return {
        channelId: channel.channelId,
        channelName: channel.channelName,
        summary: '',
        error: channel.error,
      };
    }

    try {
      const { summary } = await this.summarizeChannelThreads(
        sessionId,
        channel,
        myBotId,
        userId,
        teamId,
        client,
      );
      return {
        channelId: channel.channelId,
        channelName: channel.channelName,
        summary: summary,
      };
    } catch (error) {
      logger.error(
        `error in multi-channel summarizer during summarize channel threads: ${error} ${error.stack}`,
      );

      if (error instanceof ModerationError) {
        return {
          channelId: channel.channelId,
          channelName: channel.channelName,
          summary: '',
          error: 'moderated',
        };
      }
      if (error instanceof NoMessagesError) {
        return {
          channelId: channel.channelId,
          channelName: channel.channelName,
          summary: '',
          error: 'no_msg_error',
        };
      }
      return {
        channelId: channel.channelId,
        channelName: channel.channelName,
        summary: '',
        error: 'general_error',
      };
    }
  }

  private async summarizeChannelThreads(
    sessionId: string,
    channel: Summarization,
    myBotId: string,
    userId: string,
    teamId: string,
    client: WebClient,
  ): Promise<{ summary: string }> {
    const summarization = await retry(
      async () => {
        return await this.messagesSummarizer.summarize(
          'multi_channel',
          `${sessionId}_${channel.channelId}`,
          channel.rootMessages,
          userId,
          teamId,
          channel.channelId,
          channel.channelName,
          myBotId,
          client,
        );
      },
      {
        count: 10,
        id: `summarize_channel_${teamId}_${userId}`,
        delayer: (iteration) => {
          const max = iteration + 1; // Max possible minutes to wait
          const min = 1; // Min possible minutes to wait
          const minute = 60 * 1000; // Milliseconds in a minute
          const random = Math.floor(Math.random() * (max - min) + min); // Random between max and min
          return delay(minute * random);
        },
      },
    );

    return {
      summary: summarization.summary,
    };
  }

  getMultiChannelSummaryFormatted(
    summaries: MultiChannelSummarizerOutput,
  ): string[] {
    const channelMap = new Map(
      summaries.summaries.map((object) => {
        return [object.channelId, undefined];
      }),
    );
    return formatMultiChannelSummary(summaries, channelMap);
  }
}
