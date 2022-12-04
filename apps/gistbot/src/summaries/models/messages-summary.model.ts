import { logger } from '@base/logger';
import axios, { AxiosProxyConfig } from 'axios';
import { ModerationError } from '../errors/moderation-error';
import { OpenAiModerationModel } from './openai-moderation.model';
import { approximatePromptCharacterCountForChannelSummaryModelMessages } from './prompt-character-calculator';

export type MessagesSummaryRequest = ModelMessage[];

export interface ModelMessageReaction {
  name: string;
  count: number;
}

export interface ModelMessage {
  ts: string;
  thread_ts: string;
  channel: string;
  channel_id: string;
  user_id: string;
  user_name: string;
  user_title: string;
  reactions: ModelMessageReaction[];
  text: string;
}

export interface ConversationSummary {
  rootMessageTs: string;
  subMessagesTs: string[];
  language: string;
  title: string;
  summary: string;
}

export interface Response {
  non_english: {
    LANGUAGE: { [key: string]: string };
    THREAD_TS: { [key: string]: string };
    SUB_TS: { [key: string]: string[] };
    TS: { [key: string]: string };
    TITLES?: { [key: string]: string };
    SUMMARY?: { [key: string]: string };
  };

  english: {
    TITLES: { [key: string]: string };
    SUMMARY: { [key: string]: string };
    THREAD_TS: { [key: string]: string };
    SUB_TS: { [key: string]: string[] };
  };
}

interface ModelResponse extends Response {
  from?: 'model-channel-summary';
  error?: string;
}

export class MessagesSummaryModel {
  private apiEndpoint: string;
  private moderationApi: OpenAiModerationModel;
  private proxyConfig?: AxiosProxyConfig;

  constructor() {
    this.apiEndpoint = process.env.CHANNEL_SUMMARY_MODEL_URL as string;
    this.moderationApi = new OpenAiModerationModel();
    if (process.env.MODELS_PROXY_URL) {
      this.proxyConfig = {
        protocol: 'http',
        host: process.env.MODELS_PROXY_URL,
        port: 8080,
      };
    }
  }

  async summarize(
    data: MessagesSummaryRequest,
    requestingUserId: string,
  ): Promise<ConversationSummary[]> {
    try {
      const res = await axios.post<ModelResponse>(
        this.apiEndpoint,
        {
          messages: data,
          user_id: requestingUserId,
        },
        {
          timeout: 1000 * (60 * 10), // Milliseconds
          proxy: this.proxyConfig,
        },
      );

      logger.info({
        msg: 'Messages Summary Model returned with response',
        status: res.status,
        data: res.data,
        request: data,
        approximateTokenCount:
          approximatePromptCharacterCountForChannelSummaryModelMessages(data),
      });

      if (res.status >= 300) {
        throw new Error('Invalid status code response');
      }

      if (!res.data) {
        throw new Error('Invalid response');
      }

      if (res.data.error) {
        throw new Error(`Error response: ${res.data.error}`);
      }

      const conversations = this.convertModelResponseToSummaries(res.data);

      try {
        const { flagged } = await this.moderationApi.moderate({
          input:
            conversations.map((c) => `${c.title}\n${c.summary}`).join('\n') ||
            '',
        });

        if (flagged) {
          throw new ModerationError('moderated');
        }
      } catch (error) {
        if (error instanceof ModerationError) {
          throw new ModerationError('moderated');
        }

        logger.error(
          `error in moderation of channel summarization: ${error} ${
            error.stack
          } ${error.response && JSON.stringify(error.response.data)}`,
        );
      }

      return conversations;
    } catch (error) {
      logger.error(
        `error in channel summarization model: ${error} ${error.stack} ${
          error.response && JSON.stringify(error.response.data)
        }`,
      );
      throw error;
    }
  }

  convertModelResponseToSummaries(input: ModelResponse): ConversationSummary[] {
    const summaries: ConversationSummary[] = [];

    // English
    for (const key in input.english.THREAD_TS) {
      if (!Object.prototype.hasOwnProperty.call(input.english.THREAD_TS, key)) {
        continue;
      }

      const threadTs = input.english.THREAD_TS[key];
      const subMessages = input.english.SUB_TS[key] || [];
      const title = input.english.TITLES[key];
      const summary = input.english.SUMMARY[key];

      if (!threadTs || !title || !summary) {
        logger.warn({
          msg: `key mismatch in messages summary model`,
          context: 'english',
          key: key,
          input: input.english,
        });
        continue;
      }

      summaries.push({
        rootMessageTs: threadTs,
        subMessagesTs: subMessages.sort((a, b) => {
          return this.sortTimestamps(a, b);
        }),
        language: 'english',
        title: title,
        summary: summary,
      });
    }

    // Non English
    for (const key in input.non_english.THREAD_TS) {
      if (
        !Object.prototype.hasOwnProperty.call(input.non_english.THREAD_TS, key)
      ) {
        continue;
      }

      const threadTs = input.non_english.THREAD_TS[key];
      const threadLanguage = input.non_english.LANGUAGE[key];
      const subMessages = input.non_english.SUB_TS[key] || [];

      if (!threadTs || !threadLanguage) {
        logger.warn({
          msg: `key mismatch in messages summary model`,
          context: 'non_english',
          key: key,
          input: input.non_english,
        });
        continue;
      }

      const summary = {
        rootMessageTs: threadTs,
        subMessagesTs: subMessages.sort((a, b) => {
          return this.sortTimestamps(a, b);
        }),
        language: threadLanguage,
        title: '',
        summary: '',
      };

      // Add some minor prep for if we return the summaries on languages in the future?
      if (input.non_english.TITLES) {
        summary.title = input.non_english.TITLES[key];
      }

      if (input.non_english.SUMMARY) {
        summary.summary = input.non_english.SUMMARY[key];
      }

      summaries.push(summary);
    }

    return summaries.sort((a, b) => {
      return this.sortConversationSummaries(a, b);
    });
  }

  private sortConversationSummaries(
    s1: ConversationSummary,
    s2: ConversationSummary,
  ) {
    return this.sortTimestamps(s1.rootMessageTs, s2.rootMessageTs);
  }

  private sortTimestamps(ts1: string, ts2: string) {
    if (ts1 < ts2) {
      return -1;
    }
    if (ts2 < ts1) {
      return 1;
    }
    return 0;
  }
}
