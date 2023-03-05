import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
} from 'openai';
import { IChatMessage } from './types';

const STATIC_PROMT = `
  You are a helpful assistant called theGist which lives inside slack. You accept the /gist command which summarizes all the slack messages in a thread.
`;

export const chatModelPrompt = (
  messages: IChatMessage[],
): ChatCompletionRequestMessage[] => {
  const promptMessages = messages.map(({ text, isGistBot, username }) => {
    if (isGistBot) {
      return {
        role: ChatCompletionRequestMessageRoleEnum.Assistant,
        content: text,
      };
    }

    return {
      role: ChatCompletionRequestMessageRoleEnum.User,
      content: username ? `${username}: ${text}` : text,
    };
  });

  return [
    {
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: STATIC_PROMT,
    },
    ...promptMessages,
  ];
};
