import { SlackMessage } from '../summaries/types';
import { Message } from '@slack/web-api/dist/response/ConversationsRepliesResponse';
import { BotSummarization } from './types';

export abstract class IBotIntegration {
  abstract getName(): string;

  match(msg: Message | SlackMessage): boolean {
    const botProfileName =
      'root' in msg ? msg.root?.bot_profile?.name : msg.bot_profile?.name;
    if (!msg.bot_id || !botProfileName) {
      return false;
    }

    return botProfileName.toLowerCase() === this.getName().toLowerCase();
  }

  abstract handleBotMessages(
    botMessages: (Message | SlackMessage)[],
  ): BotSummarization;
}
