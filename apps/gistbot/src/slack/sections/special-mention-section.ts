import { WebClient } from '@slack/web-api';
import { ParsedMessagePlaintextOpts } from '../parser';

export class SpecialMentionSection {
  type: 'special_mention' = 'special_mention';
  mention: 'channel' | 'everyone' | 'here';
  label?: string;

  constructor(initial?: {
    mention?: 'channel' | 'everyone' | 'here';
    label?: string;
  }) {
    this.mention = initial?.mention || 'channel';
    this.label = initial?.label;
  }

  async plainText(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    teamId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    client?: WebClient,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts?: ParsedMessagePlaintextOpts,
  ): Promise<string> {
    return `@${this.label || this.mention}`;
  }
}
