import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
} from 'openai';
import { IChatMessage } from './types';

export const chatModelPrompt = (
  messages: IChatMessage[],
): ChatCompletionRequestMessage[] => {
  return messages.map(({ text, isGistBot }) => {
    if (isGistBot) {
      return {
        role: ChatCompletionRequestMessageRoleEnum.Assistant,
        content: text,
      };
    }

    return {
      role: ChatCompletionRequestMessageRoleEnum.User,
      content: text,
    };
  });
};
