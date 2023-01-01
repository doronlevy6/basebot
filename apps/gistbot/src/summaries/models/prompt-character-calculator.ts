import { ChannelSummaryModelRequest } from './channel-summary.model';
import { MessagesSummaryRequest } from './messages-summary.model';
import { ThreadSummaryModelRequest } from './thread-summary.model';
import { IChatMessage } from '../../experimental/chat/types';

export const MAX_PROMPT_CHARACTER_COUNT = 10000;

export function approximatePromptCharacterCount(
  data: ThreadSummaryModelRequest,
): number {
  const messages = escapeUnicode(data.messages.join('\\n\\n'));
  const names = escapeUnicode(data.names.join('\\n\\n'));
  const titles = escapeUnicode(data.titles.join('\\n\\n'));

  const approximateNewlinesAndColons =
    (data.names.length + data.messages.length + data.titles.length) * 2;
  return (
    messages.length +
    names.length +
    titles.length +
    approximateNewlinesAndColons
  );
}

export function approximatePromptCharacterCountForChannelSummary(
  data: ChannelSummaryModelRequest,
): number {
  return (
    4 * data.threads.length +
    data.threads.reduce((acc, currentThread) => {
      const messages = escapeUnicode(currentThread.messages.join('\\n\\n'));
      const names = escapeUnicode(currentThread.names.join('\\n\\n'));
      const titles = escapeUnicode(currentThread.titles.join('\\n\\n'));

      const approximateNewlinesAndColons =
        (currentThread.names.length +
          currentThread.messages.length +
          currentThread.titles.length) *
        2;

      const approximatePerThread =
        messages.length +
        names.length +
        titles.length +
        approximateNewlinesAndColons;

      return acc + approximatePerThread;
    }, 0)
  );
}

export function approximatePromptCharacterCountForChannelSummaryModelMessages(
  data: MessagesSummaryRequest,
): number {
  return (
    4 * data.length +
    data.reduce((acc, currentMessage) => {
      const messageText = escapeUnicode(currentMessage.text);
      const name = escapeUnicode(currentMessage.user_name);
      const title = escapeUnicode(currentMessage.user_title);
      const reactions = currentMessage.reactions.reduce((acc, reaction) => {
        return acc + reaction.name.length + 2;
      }, 0);

      const approximateNewlinesAndColons = 6; // Just based on what we will send?

      const approximatePerMessage =
        currentMessage.channel.length +
        messageText.length +
        name.length +
        title.length +
        reactions +
        approximateNewlinesAndColons;

      return acc + approximatePerMessage;
    }, 0)
  );
}
export function approximatePromptCharacterCountForChatMessages(
  data: IChatMessage[],
): number {
  return (
    4 * data.length +
    data.reduce((acc, currentMessage) => {
      const messageText = escapeUnicode(currentMessage?.text || '');
      const name = escapeUnicode(currentMessage?.username || '');

      const approximateNewlinesAndColons = 6; // Just based on what we will send?

      const approximatePerMessage =
        messageText.length + name.length + approximateNewlinesAndColons;

      return acc + approximatePerMessage;
    }, 0)
  );
}
const escapeUnicode = (str: string) => {
  return str.replace(/[\u00A0-\uffff]/gu, function (c) {
    return '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4);
  });
};
