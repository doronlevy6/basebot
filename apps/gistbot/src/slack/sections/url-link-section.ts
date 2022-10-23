import { WebClient } from '@slack/web-api';
import { ParsedMessagePlaintextOpts } from '../parser';

export class UrlLinkSection {
  type: 'url_link' = 'url_link';
  url: string;
  label?: string;

  constructor(initial?: { url?: string; label?: string }) {
    this.url = initial?.url || '';
    this.label = initial?.label;
  }

  async plainText(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    teamId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    client?: WebClient,
    opts?: ParsedMessagePlaintextOpts,
  ): Promise<string> {
    if (this.label) {
      return this.label;
    }

    if (opts?.stripUnlabelsUrls) {
      return opts.unlabeledUrlReplacement || '';
    }

    return this.url;
  }
}
