import { logger } from '@base/logger';
import axios from 'axios';
import { ModerationError } from '../errors/moderation-error';
import { OpenAiModerationModel } from './openai-moderation.model';
import { approximatePromptCharacterCount } from './prompt-character-calculator';

export interface ThreadSummaryModelRequest {
  messages: string[];
  names: string[];
  titles: string[];
  channel_name: string;
}

interface ModelResponse {
  data: string[];
  from?: 'model-thread-summary';
  error?: string;
}

export class ThreadSummaryModel {
  private apiEndpoint: string;
  private moderationApi: OpenAiModerationModel;

  constructor() {
    this.apiEndpoint = process.env.THREAD_SUMMARY_MODEL_URL as string;
    this.moderationApi = new OpenAiModerationModel();
  }

  async summarizeThread(
    data: ThreadSummaryModelRequest,
    requestingUserId: string,
  ): Promise<string> {
    try {
      const res = await axios.post<ModelResponse>(
        this.apiEndpoint,
        { threads: [data], user_id: requestingUserId },
        {
          timeout: 1000 * (60 * 10), // Milliseconds
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
          input: res.data.data[0],
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
          } ${error.response && error.response.data}`,
        );
      }

      return res.data.data[0];
    } catch (error) {
      logger.error(
        `error in thread summarization model: ${error} ${error.stack} ${
          error.response && error.response.data
        }`,
      );
      throw error;
    }
  }
}
