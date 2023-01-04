import { AnalyticsManager } from '@base/gistbot-shared';
import { SlackBlockActionWrapper } from '../slack/types';
import { IReporter } from '@base/metrics';
import { IChatMessage } from '../experimental/chat/types';
import { chatModelPrompt } from '../experimental/chat/prompt';
import { ChatModel } from '../experimental/chat/chat.model';
import { httpRequestResponseText } from './httpRequestResponseText';

const HTTP_EXAMPLE_QUESTION = 'How do I make an HTTP request in Javascript?';
export const chatActionItemHandler =
  (
    analyticsManager: AnalyticsManager,
    metricsReporter: IReporter,
    chatModel: ChatModel,
  ) =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    try {
      await ack();
      const value = body.actions[0]['value'] as string;

      analyticsManager.chatGistActionItem({
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || 'Unknown',
        type: value,
      });

      if (value === HTTP_EXAMPLE_QUESTION) {
        await client.chat.postMessage({
          channel: body.user.id,
          text: httpRequestResponseText,
        });
        return;
      }
      const message: IChatMessage = {
        text: value,
        isBot: false,
        isGistBot: false,
        username: body.user.name,
      };
      const prompt = chatModelPrompt([message]);
      const res = await chatModel.customModel(prompt, body.user.id);
      await client.chat.postMessage({ channel: body.user.id, text: res });
    } catch (err) {
      logger.error(
        `user ${body.user.id} ${body.user.name} on team: ${
          body.team?.id || 'Unknown'
        }chat gist action item handler error: ${err.stack}`,
      );
    }
  };
