import { SlackMessage } from '../summaries/types';
import { IBotIntegration } from './ibot-integration';
import { Message } from '@slack/web-api/dist/response/ConversationsRepliesResponse';
import { BotSummarizationOutput } from './types';

export class BotsManager {
  private bots: Map<string, IBotIntegration> = new Map();
  private readonly singleBotChannelDetectionLimit = 0.7;

  constructor(...bots: IBotIntegration[]) {
    bots.forEach((bot) => {
      this.bots.set(bot.getName(), bot);
    });
  }

  handleBots(messages: (Message | SlackMessage)[]): BotSummarizationOutput[] {
    const botMessages: Map<string, (Message | SlackMessage)[]> = new Map();
    messages.forEach((msg) => {
      for (const [botName, integration] of this.bots) {
        if (!integration.match(msg)) {
          continue;
        }

        const messages = botMessages.get(botName) || [];
        messages.push(msg);
        botMessages.set(botName, messages);
        // Return here within the foreach loop,
        // We want to ensure that a message should only ever match a single bot integration.
        return;
      }
    });

    const botSummaries: BotSummarizationOutput[] = [];
    for (const [botName, bmsgs] of botMessages) {
      const bot = this.bots.get(botName);
      if (!bot || !messages.length || !bmsgs.length) {
        continue;
      }

      let detectedAsSingleBotChannel = false;
      if (
        bmsgs.length / messages.length >=
        this.singleBotChannelDetectionLimit
      ) {
        detectedAsSingleBotChannel = true;
      }

      const summarization = bot.handleBotMessages(bmsgs);
      botSummaries.push({ ...summarization, detectedAsSingleBotChannel });
    }

    return botSummaries;
  }
}
