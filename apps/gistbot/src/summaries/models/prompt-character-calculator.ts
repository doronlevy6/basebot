import { ModelRequest } from './thread-summary.model';

export const MAX_PROMPT_CHARACTER_COUNT = 15000;

export function approximatePromptCharacterCount(data: ModelRequest): number {
  const escapeUnicode = (str: string) => {
    return str.replace(/[\u00A0-\uffff]/gu, function (c) {
      return '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4);
    });
  };
  const messages = escapeUnicode(data.messages.join('\\n\\n'));
  const names = escapeUnicode(data.names.join('\\n\\n'));

  const approximateNewlinesAndColons =
    (data.names.length + data.messages.length) * 2;
  return messages.length + names.length + approximateNewlinesAndColons;
}
