import { SlackMessage } from '../summaries/types';
import { Message } from '@slack/web-api/dist/response/ConversationsRepliesResponse';
import { BotSummarizationOutput } from './types';

export interface IBotIntegration {
  getName(): string;
  handleBotMessages(
    messages: (Message | SlackMessage)[],
  ): BotSummarizationOutput;
}
