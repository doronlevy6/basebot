import { logger } from '@base/logger';
import axios from 'axios';

const MODEL_URL = 'https://api.openai.com/v1/moderations';

export interface IModelRequest {
  input: string;
}

interface IModeationResult {
  categories: {
    [category: string]: boolean;
  };
  category_scores: {
    [category: string]: number;
  };
  flagged: boolean;
}

interface IModelResponse {
  id: string;
  model: string;
  results: IModeationResult[];
}

interface IResponse {
  flagged: boolean;
}

export class OpenAiModerationModel {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPEN_AI_KEY as string;
  }

  async moderate(requestBody: IModelRequest): Promise<IResponse> {
    try {
      logger.debug({
        msg: 'Calling moderation api',
        chars: requestBody.input.length,
      });

      const { data, status } = await axios.post<IModelResponse>(
        MODEL_URL,
        requestBody,
        {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          timeout: 1000 * 10, // Milliseconds
        },
      );

      logger.info({
        msg: 'Moderation Model returned with response',
        status,
        data,
        request: requestBody,
      });

      if (status >= 300) {
        throw new Error('Invalid status code response');
      }

      if (!data || !data.results?.length) {
        throw new Error('Invalid response');
      }

      const result = data.results[0];

      if (result.flagged) {
        logger.error({ msg: 'Result flagged', res: data, req: requestBody });
      }

      return {
        flagged: result.flagged,
      };
    } catch (error) {
      logger.error(`error in moderation: ${error}`);
      throw error;
    }
  }
}
