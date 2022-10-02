import { logger } from '@base/logger';
import axios from 'axios';
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

interface ModelResponse {
  data: string;
  from?: 'model-channel-summary';
  error?: string;
}

export class ChannelSummaryModel {
  private apiEndpoint: string;
  private moderationApi: OpenAiModerationModel;

  constructor() {
    this.apiEndpoint = process.env.CHANNEL_SUMMARY_MODEL_URL as string;
    this.moderationApi = new OpenAiModerationModel();
  }

  async summarizeChannel(
    data: ChannelSummaryModelRequest,
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

      const { flagged } = await this.moderationApi.moderate({
        input: res.data.data,
      });

      if (flagged) {
        throw new ModerationError('moderated');
      }

      return res.data.data;
    } catch (error) {
      logger.error(
        `error in channel summarization model: ${error} ${error.stack} ${error.response.data}`,
      );
      throw error;
    }
  }
}
