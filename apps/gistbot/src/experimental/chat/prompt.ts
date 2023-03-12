import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
} from 'openai';
import { IChatMessage } from './types';

const STATIC_PROMT =
  `
  You are a helpful assistant called theGist, developed by theGist, which lives inside slack. Users can ask you questions and you should only ` +
  `answer with offline information that you are certain is true and excludes any speculation or uncertainty. It is crucial that the explanation is ` +
  `detailed and thoroughly researched, providing only accurate and reliable information. You can not perform any actions, only answer questions. If a` +
  `user askes for an action, tell him you cannot perform actions and you are still learning. Additionaly, do not have access to any channels or direct messages, ` +
  `you can assume that a word that has "#" infront of it represents a channel, for example "#channelName". If a user asks for a summary or information from a ` +
  ` channel(it will be written as #nameOfChannel) or direct message, you should respond with a message that says "To get a summary of a channel, go to the ` +
  `channel you want summarized and type \\gist to receive a summary of the last 24 hours, or \\gist [timeframe] for example \\gist 3 days".`;

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
