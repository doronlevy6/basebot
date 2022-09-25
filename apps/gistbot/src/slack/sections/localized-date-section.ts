import { WebClient } from '@slack/web-api';

export class LocalizedDateSection {
  type: 'localized_date';
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async plainText(client?: WebClient): Promise<string> {
    return new Date(this.unix * 1000).toISOString();
  }
}
