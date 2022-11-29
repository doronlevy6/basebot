import { SlackMessage } from '../summaries/types';
import { IBotIntegration } from './ibot-integration';
import { Message } from '@slack/web-api/dist/response/ConversationsRepliesResponse';

export class BotsManager {
  private bots: Map<string, IBotIntegration> = new Map();
  private readonly botDetectionLimit = 0.7;

  constructor(...bots: IBotIntegration[]) {
    bots.forEach((bot) => {
      this.bots.set(bot.getName(), bot);
    });
  }

  handleBots(messages: (Message | SlackMessage)[]) {
    const botMessages: (Message | SlackMessage)[] = [];
    const botTypesCounter: Map<string, number> = new Map();

    messages.forEach((msg) => {
      if (
        msg.bot_id &&
        msg.bot_profile?.name &&
        this.bots.has(msg.bot_profile?.name)
      ) {
        botMessages.push(msg);
        const counter = botTypesCounter.get(msg.bot_profile.name) || 0;
        botTypesCounter.set(msg.bot_profile.name, counter + 1);
      }
    });

    for (const [type, counter] of botTypesCounter) {
      if (
        messages.length &&
        counter / messages.length >= this.botDetectionLimit
      ) {
        return this.bots.get(type)?.handleBotMessages(botMessages);
      }
    }
  }
}
