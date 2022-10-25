import { logger } from '@base/logger';
import axios, { AxiosProxyConfig } from 'axios';
import { ModerationError } from '../errors/moderation-error';
import { OpenAiModerationModel } from './openai-moderation.model';
import { approximatePromptCharacterCountForChannelSummary } from './prompt-character-calculator';

export interface ChannelSummaryModelRequest {
  channel_name: string;
  threads: {
    messages: string[];
    names: string[];
    titles: string[];
  }[];
}

export interface ChannelSummary {
  summary_by_threads: string[];
}

interface ModelResponse extends ChannelSummary {
  from?: 'model-channel-summary';
  error?: string;
}

export class ChannelSummaryModel {
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

  async summarizeChannel(
    data: ChannelSummaryModelRequest,
    requestingUserId: string,
  ): Promise<ChannelSummary> {
    try {
      const res = await axios.post<ModelResponse>(
        this.apiEndpoint,
        { ...data, user_id: requestingUserId },
        {
          timeout: 1000 * (60 * 10), // Milliseconds
          proxy: this.proxyConfig,
        },
      );

      logger.info({
        msg: 'Channel Summary Model returned with response',
        status: res.status,
        data: res.data,
        request: data,
        approximateTokenCount:
          approximatePromptCharacterCountForChannelSummary(data),
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
          input: res.data.summary_by_threads.join('\n') || '',
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

      return {
        summary_by_threads: res.data.summary_by_threads,
      };
    } catch (error) {
      logger.error(
        `error in channel summarization model: ${error} ${error.stack} ${
          error.response && JSON.stringify(error.response.data)
        }`,
      );
      throw error;
    }
  }
}
