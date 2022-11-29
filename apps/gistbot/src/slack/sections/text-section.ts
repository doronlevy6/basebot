import { WebClient } from '@slack/web-api';
import { ParsedMessagePlaintextOpts } from '../parser';
import { EmojiConvertor } from 'emoji-js';

export class TextSection {
  type: 'text' = 'text';
  text: string;

  constructor(initial?: { text?: string }) {
    this.text = initial?.text || '';
  }

  async plainText(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    teamId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    client?: WebClient,
    opts?: ParsedMessagePlaintextOpts,
  ): Promise<string> {
    const emoji = new EmojiConvertor();
    emoji.replace_mode = 'unified';
    const emojisReplaced = emoji.replace_colons(
      this.text.replace(/::skin-tone(-?\d+)/gi, ''),
    );
    const multilineCodeStripped = stripMrkdwnFormatting(
      emojisReplaced,
      '```',
      true,
      opts?.removeCodeblocks,
    );
    const codeStripped = stripMrkdwnFormatting(multilineCodeStripped, '`');
    const italicsStripped = stripMrkdwnFormatting(codeStripped, '_');
    const boldStripped = stripMrkdwnFormatting(italicsStripped, `\\*`);
    const strikeStripped = stripMrkdwnFormatting(boldStripped, `~`);

    return strikeStripped;
  }
}

export function stripMrkdwnFormatting(
  mrkdwn: string,
  pattern: string,
  multiline?: boolean,
  exclude?: boolean,
): string {
  let rgx: RegExp;
  if (multiline) {
    rgx = new RegExp(`${pattern}([\\s\\S]*?)${pattern}`, 'gm');
  } else {
    rgx = new RegExp(`${pattern}(.*?)${pattern}`, 'g');
  }

  const fmts = mrkdwn.matchAll(rgx);
  if (!fmts) {
    return mrkdwn;
  }

  let stripped = '';
  let startIndex = 0;
  for (const fmtMatch of fmts) {
    // Check explicitly for null and undefined because 0 is a valid value
    if (fmtMatch.index === undefined || fmtMatch.index === null) {
      throw new Error('no index found on match');
    }

    if (fmtMatch.index > 0) {
      stripped = `${stripped}${mrkdwn.substring(startIndex, fmtMatch.index)}`;
    }

    if (!exclude) {
      const extractedValue = fmtMatch[1];
      stripped = `${stripped}${extractedValue}`;
    }
    startIndex = fmtMatch.index + fmtMatch[0].length;
  }

  if (startIndex < mrkdwn.length) {
    stripped = `${stripped}${mrkdwn.substring(startIndex)}`;
  }

  return stripped;
}
