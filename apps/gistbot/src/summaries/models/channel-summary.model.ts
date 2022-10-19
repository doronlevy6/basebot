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
  summary_by_summary: string;
  summary_by_topics: 'TBD' | Record<string, string>;
  summary_by_everything: string;
  summary_by_bullets: string[];
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

      if (res.data.summary_by_topics === 'TBD') {
        res.data.summary_by_topics = {};
      }

      let summaryByTopics = '';
      for (const key in res.data.summary_by_topics) {
        if (
          Object.prototype.hasOwnProperty.call(res.data.summary_by_topics, key)
        ) {
          const element = res.data.summary_by_topics[key];
          summaryByTopics = `${summaryByTopics}${key}:\n${element}\n`;
        }
      }

      try {
        const [resSbS, resSbT, resSbE, resSbB] = await Promise.all([
          this.moderationApi.moderate({
            input: res.data.summary_by_summary,
          }),
          this.moderationApi.moderate({
            input: summaryByTopics,
          }),
          this.moderationApi.moderate({
            input: res.data.summary_by_everything,
          }),
          this.moderationApi.moderate({
            input: res.data.summary_by_bullets.join('\n'),
          }),
        ]);

        let moderatedCount = 0;
        if (resSbS.flagged) {
          res.data.summary_by_summary = '';
          moderatedCount++;
        }
        if (resSbT.flagged) {
          res.data.summary_by_topics = {};
          moderatedCount++;
        }
        if (resSbE.flagged) {
          res.data.summary_by_everything = '';
          moderatedCount++;
        }
        if (resSbB.flagged) {
          res.data.summary_by_bullets = [];
          moderatedCount++;
        }

        // If all 4 have been moderated then we return a moderation error
        if (moderatedCount === 4) {
          throw new ModerationError('moderated');
        }
      } catch (error) {
        if (error instanceof ModerationError) {
          throw new ModerationError('moderated');
        }

        logger.error(
          `error in moderation of channel summarization: ${error} ${
            error.stack
          } ${error.response && error.response.data}`,
        );
      }

      return {
        summary_by_summary: res.data.summary_by_summary,
        summary_by_topics: res.data.summary_by_topics,
        summary_by_everything: res.data.summary_by_everything,
        summary_by_bullets: res.data.summary_by_bullets,
      };
    } catch (error) {
      logger.error(
        `error in channel summarization model: ${error} ${error.stack} ${
          error.response && error.response.data
        }`,
      );
      throw error;
    }
  }
}
