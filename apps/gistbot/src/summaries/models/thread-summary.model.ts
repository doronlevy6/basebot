import { logger } from '@base/logger';
import axios, { AxiosProxyConfig } from 'axios';
import { ModerationError } from '../errors/moderation-error';
import { OpenAiModerationModel } from './openai-moderation.model';
import { approximatePromptCharacterCount } from './prompt-character-calculator';

export interface ThreadSummaryModelRequest {
  messages: string[];
  names: string[];
  titles: string[];
  reactions: number[];
  channel_name: string;
}
export interface ThreadSummaryModelResponse {
  summary: string;
  title: string;
}
export interface ThreadSummary {
  summary_by_threads: string[];
  titles: string[];
  tags: string[];
  languages?: string[];
}

interface ModelResponse extends ThreadSummary {
  from?: 'model-channel-summary';
  error?: string;
}

export class ThreadSummaryModel {
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

  async summarizeThread(
    data: ThreadSummaryModelRequest,
    requestingUserId: string,
  ): Promise<ThreadSummaryModelResponse> {
    try {
      const res = await axios.post<ModelResponse>(
        this.apiEndpoint,
        {
          channel_name: data.channel_name,
          threads: [data],
          user_id: requestingUserId,
        },
        {
          timeout: 1000 * (60 * 10), // Milliseconds
          proxy: this.proxyConfig,
        },
      );
      logger.info({
        msg: 'Thread Summary Model returned with response',
        status: res.status,
        data: res.data,
        request: data,
        approximateTokenCount: approximatePromptCharacterCount(data),
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

      try {
        const { flagged } = await this.moderationApi.moderate({
          input: res.data.summary_by_threads[0],
        });

        if (flagged) {
          throw new ModerationError('moderated');
        }
      } catch (error) {
        if (error instanceof ModerationError) {
          throw new ModerationError('moderated');
        }

        logger.error(
          `error in moderation of thread summarization: ${error} ${
            error.stack
          } ${error.response && JSON.stringify(error.response.data)}`,
        );
      }

      return {
        summary: res.data.summary_by_threads[0],
        title: res.data.titles[0],
      };
    } catch (error) {
      logger.error(
        `error in thread summarization model: ${error} ${error.stack} ${
          error.response && JSON.stringify(error.response.data)
        }`,
      );
      throw error;
    }
  }
}
