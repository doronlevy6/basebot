import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '@base/gistbot-shared';
import { ChannelSummarizer, MAX_MESSAGES_TO_FETCH } from './channel-summarizer';
import { ChannelSummaryModel } from '../models/channel-summary.model';
import {
  MultiChannelSummarizationProps,
  MultiChannelSummaryContext,
  SlackMessage,
} from '../types';
import {
  enrichWithReplies,
  parseThreadForSummary,
  sortSlackMessages,
} from '../utils';
import {
  approximatePromptCharacterCountForChannelSummary,
  MAX_PROMPT_CHARACTER_COUNT,
} from '../models/prompt-character-calculator';
import { retry, delay } from '../../utils/retry';
import { Message } from '@slack/web-api/dist/response/ChannelsRepliesResponse';
import { ModerationError } from '../errors/moderation-error';
import {
  formatMultiChannelSummary,
  formatSummary,
} from '../../slack/summary-formatter';

type OutputError = 'channel_too_small' | 'moderated' | 'general_error';

interface Summarization {
  channelId: string;
  channelName: string;
  rootMessages: SlackMessage[];
  error?: OutputError;
}

interface ThreadData {
  data: {
    messageIds: string[];
    messages: string[];
    users: string[];
    userIds: string[];
    reactions: number[];
    titles: string[];
  }[];
  error?: OutputError;
}

interface OutputSummary {
  channelId: string;
  channelName: string;
  summary: string;
  earliestMessageTs: string;
  error?: OutputError;
}

export interface MultiChannelSummarizerOutput {
  summaries: OutputSummary[];
  error?: OutputError;
}

export class MultiChannelSummarizer {
  constructor(
    private channelSummaryModel: ChannelSummaryModel,
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
          this.summarizeChannel(channel, myBotId, userId, teamId, client),
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
        earliestMessageTs: '',
        error: channel.error,
      };
    }

    const threadData = await this.parseThreadsForChannel(
      channel,
      myBotId,
      teamId,
      client,
    );

    if (threadData.error) {
      return {
        channelId: channel.channelId,
        channelName: channel.channelName,
        summary: '',
        earliestMessageTs: '',
        error: threadData.error,
      };
    }

    try {
      const { summary, earliestMessageTs } = await this.summarizeChannelThreads(
        channel,
        threadData,
        userId,
      );
      return {
        channelId: channel.channelId,
        channelName: channel.channelName,
        summary: summary,
        earliestMessageTs: earliestMessageTs,
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
          earliestMessageTs: '',
          error: 'moderated',
        };
      }

      return {
        channelId: channel.channelId,
        channelName: channel.channelName,
        summary: '',
        earliestMessageTs: '',
        error: 'general_error',
      };
    }
  }

  private async parseThreadsForChannel(
    channel: Summarization,
    myBotId: string,
    teamId: string,
    client: WebClient,
  ): Promise<ThreadData> {
    channel.rootMessages.sort(sortSlackMessages);

    let messagesWithReplies: {
      message: SlackMessage;
      replies: Message[];
    }[];
    try {
      messagesWithReplies = await retry(
        async () => {
          return await enrichWithReplies(
            channel.channelId,
            channel.rootMessages,
            client,
            myBotId,
          );
        },
        { count: 10 },
      );
    } catch (error) {
      logger.error(
        `error in multi-channel summarizer during enrich with replies: ${error} ${error.stack}`,
      );
      return { data: [], error: 'general_error' };
    }

    try {
      const threads = await retry(
        async () => {
          return await Promise.all(
            messagesWithReplies.map((mwr) => {
              const thread = parseThreadForSummary(
                [mwr.message, ...mwr.replies],
                client,
                teamId,
                MAX_PROMPT_CHARACTER_COUNT,
                channel.channelName,
                myBotId,
              );

              return thread;
            }),
          );
        },
        { count: 10 },
      );

      return {
        data: threads,
      };
    } catch (error) {
      logger.error(
        `error in multi-channel summarizer during parse thread for summary: ${error} ${error.stack}`,
      );
      return {
        data: [],
        error: 'general_error',
      };
    }
  }

  private async summarizeChannelThreads(
    channel: {
      channelId: string;
      channelName: string;
    },
    threads: ThreadData,
    userId: string,
  ): Promise<{ summary: string; earliestMessageTs: string }> {
    let successfulSummary = '';

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let req = {
        channel_name: channel.channelName,
        threads: threads.data.map((t) => {
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
        threads.data.shift();
        req = {
          channel_name: channel.channelName,
          threads: threads.data.map((t) => {
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

      successfulSummary = await retry(
        async () => {
          const summary = await this.channelSummaryModel.summarizeChannel(
            req,
            userId,
          );
          if (
            !summary.summary_by_threads.length ||
            summary.summary_by_threads.length === 0
          ) {
            throw new Error('no thread summaries returned');
          }
          return formatSummary(
            summary.summary_by_threads,
            summary.titles,
            false,
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

      if (successfulSummary && successfulSummary.length > 0) {
        break;
      }

      threads.data.shift();
      if (threads.data.length === 0) {
        break;
      }
    }

    if (!successfulSummary.length) {
      throw new Error('Invalid response');
    }

    return {
      summary: successfulSummary,
      earliestMessageTs: threads.data.filter(
        (td) => td.messageIds.length > 0,
      )[0].messageIds[0],
    };
  }

  async getMultiChannelSummaryFormatted(
    summaries: MultiChannelSummarizerOutput,
    client: WebClient,
  ): Promise<string[]> {
    const channelLinks = await Promise.all(
      summaries.summaries.map(async (outputSummary) => {
        try {
          const {
            error: infoError,
            ok: infoOk,
            permalink,
          } = await client.chat.getPermalink({
            channel: outputSummary.channelId,
            message_ts: outputSummary.earliestMessageTs,
          });
          if (infoError || !infoOk || !permalink) {
            throw new Error(`Failed to fetch chat permalink ${infoError}`);
          }

          return { link: permalink, channelId: outputSummary.channelId };
        } catch (e) {
          logger.error(e);
          return { channelId: outputSummary.channelId };
        }
      }),
    );
    const channelMap = new Map(
      channelLinks.map((object) => {
        return [object.channelId, object.link];
      }),
    );
    const formattedMultiChannel = formatMultiChannelSummary(
      summaries,
      channelMap,
    );

    return formattedMultiChannel;
  }
}
