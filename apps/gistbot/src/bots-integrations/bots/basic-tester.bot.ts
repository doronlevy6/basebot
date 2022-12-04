import { SlackMessage } from '../../summaries/types';
import { Message } from '@slack/web-api/dist/response/ConversationsRepliesResponse';
import { IBotIntegration } from '../ibot-integration';

export class BasicTesterBot extends IBotIntegration {
  getName(): string {
    return 'BasicTesterBot';
  }

  handleBotMessages(botMessages: (Message | SlackMessage)[]) {
    return {
      summary: 'random summary',
      numberOfMessages: botMessages.length,
      botName: this.getName(),
    };
  }
}

export class BasicTesterBot2 extends IBotIntegration {
  getName(): string {
    return 'BasicTesterBot2';
  }

  handleBotMessages(botMessages: (Message | SlackMessage)[]) {
    return {
      summary: 'random summary 2',
      numberOfMessages: botMessages.length,
      botName: this.getName(),
    };
  }
}
