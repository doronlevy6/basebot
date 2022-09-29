import { logger } from '@base/logger';
import axios from 'axios';
import { approximatePromptCharacterCount } from './prompt-character-calculator';

export interface ModelRequest {
  messages: string[];
  names: string[];
  titles: string[];
}

interface ModelResponse {
  data: string;
  from?: 'model-thread-summary';
  error?: string;
}

export class ThreadSummaryModel {
  private apiEndpoint: string;

  constructor() {
    this.apiEndpoint = process.env.THREAD_SUMMARY_MODEL_URL as string;
  }

  async summarizeThread(
    data: ModelRequest,
    requestingUserId: string,
  ): Promise<string> {
    try {
      const res = await axios.post<ModelResponse>(
        this.apiEndpoint,
        { ...data, user_id: requestingUserId },
        {
          timeout: 1000 * 60, // Milliseconds
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

      return res.data.data;
    } catch (error) {
      logger.error(`error in thread summarization: ${error.stack}`);
      throw error;
    }
  }
}
