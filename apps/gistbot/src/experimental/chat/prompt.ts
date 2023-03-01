import { ChatCompletionRequestMessageRoleEnum } from 'openai';
import { IChatMessage } from './types';

export const chatModelPrompt = (messages: IChatMessage[]) => {
  return messages.map((m) => ({
    role: m.isGistBot
      ? ChatCompletionRequestMessageRoleEnum.Assistant
      : ChatCompletionRequestMessageRoleEnum.User,
    content: m.text,
  }));
};
