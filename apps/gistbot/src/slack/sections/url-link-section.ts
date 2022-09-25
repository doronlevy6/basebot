import { WebClient } from '@slack/web-api';

export class UrlLinkSection {
  type: 'url_link';
  url: string;
  label?: string;

  constructor(initial?: { url?: string; label?: string }) {
    this.url = initial?.url || '';
    this.label = initial?.label;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async plainText(client?: WebClient): Promise<string> {
    return this.label || this.url;
  }
}
