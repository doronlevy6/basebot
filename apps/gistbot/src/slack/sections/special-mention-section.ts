import { WebClient } from '@slack/web-api';

export class SpecialMentionSection {
  type: 'special_mention';
  mention: 'channel' | 'everyone' | 'here';
  label?: string;

  constructor(initial?: {
    mention?: 'channel' | 'everyone' | 'here';
    label?: string;
  }) {
    this.mention = initial?.mention || 'channel';
    this.label = initial?.label;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async plainText(teamId: string, client?: WebClient): Promise<string> {
    return `@${this.label || this.mention}`;
  }
}
