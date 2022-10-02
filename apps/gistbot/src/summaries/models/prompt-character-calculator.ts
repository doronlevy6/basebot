import { ChannelSummaryModelRequest } from './channel-summary.model';
import { ThreadSummaryModelRequest } from './thread-summary.model';

export const MAX_PROMPT_CHARACTER_COUNT = 10000;

export function approximatePromptCharacterCount(
  data: ThreadSummaryModelRequest,
): number {
  const escapeUnicode = (str: string) => {
    return str.replace(/[\u00A0-\uffff]/gu, function (c) {
      return '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4);
    });
  };
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
  const escapeUnicode = (str: string) => {
    return str.replace(/[\u00A0-\uffff]/gu, function (c) {
      return '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4);
    });
  };

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
