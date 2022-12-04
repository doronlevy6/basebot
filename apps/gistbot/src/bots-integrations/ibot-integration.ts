import { SlackMessage } from '../summaries/types';
import { Message } from '@slack/web-api/dist/response/ConversationsRepliesResponse';
import { BotSummarization } from './types';

export abstract class IBotIntegration {
  abstract getName(): string;

  match(msg: Message | SlackMessage): boolean {
    if (!msg.bot_id || !msg.bot_profile?.name) {
      return false;
    }
    return (
      msg.bot_profile?.name?.toLowerCase() === this.getName().toLowerCase()
    );
  }

  abstract handleBotMessages(
    botMessages: (Message | SlackMessage)[],
  ): BotSummarization;
}
