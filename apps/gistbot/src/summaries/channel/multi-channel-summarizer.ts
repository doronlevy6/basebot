import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '@base/gistbot-shared';
import { ChannelSummarizer, MAX_MESSAGES_TO_FETCH } from './channel-summarizer';
import {
  MultiChannelSummarizationProps,
  MultiChannelSummaryContext,
  SlackMessage,
} from '../types';
import { retry, delay } from '../../utils/retry';
import { ModerationError } from '../errors/moderation-error';
import { formatMultiChannelSummary } from '../../slack/summary-formatter';
import { MessagesSummarizer } from '../messages/messages-summarizer';
import { generateIDAsync } from '../../utils/id-generator.util';

export type OutputError = 'channel_too_small' | 'moderated' | 'general_error';

interface Summarization {
  channelId: string;
  channelName: string;
  rootMessages: SlackMessage[];
  error?: OutputError;
}

interface OutputSummary {
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

      const {
        error: infoError,
        ok: infoOk,
        user: userInfo,
      } = await client.users.info({
        user: userId,
      });
      if (infoError || !infoOk) {
        throw new Error(
          `Failed to fetch user from slack when trying to summarize multiple channels ${infoError}`,
        );
      }

      if (!userInfo) {
        throw new Error(
          `Failed to fetch user from slack when trying to summarize multiple channels, user not found`,
        );
      }

      const channels: Summarization[] = await Promise.all(
        props.channels.map(async (c): Promise<Summarization> => {
          try {
            const result = retry(
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
              { count: 10 },
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

      const channelSummaries = await Promise.all(
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

      return { summaries: channelSummaries };
    } catch (error) {
      logger.error(
        `error in multi-channel summarizer: ${error} ${error.stack}`,
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
    const formattedMultiChannel = formatMultiChannelSummary(
      summaries,
      channelMap,
    );

    return formattedMultiChannel;
  }
}
