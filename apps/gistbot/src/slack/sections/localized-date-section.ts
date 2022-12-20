import { WebClient } from '@slack/web-api';
import { ParsedMessagePlaintextOpts } from '../parser';
import { SlackDataStore } from '../../utils/slack-data-store';

export class LocalizedDateSection {
  type: 'localized_date' = 'localized_date';
  unix: number;
  format: string;
  optionalLink?: string;
  fallback?: string;

  constructor(initial?: {
    unix?: number;
    format?: string;
    optionalLink?: string;
    fallback?: string;
  }) {
    this.unix = initial?.unix || 0;
    this.format = initial?.format || '';
    this.optionalLink = initial?.optionalLink;
    this.fallback = initial?.fallback;
  }

  async plainText(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    teamId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    client?: WebClient,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts?: ParsedMessagePlaintextOpts,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    slackDataStore?: SlackDataStore,
  ): Promise<string> {
    return new Date(this.unix * 1000).toISOString();
  }
}
