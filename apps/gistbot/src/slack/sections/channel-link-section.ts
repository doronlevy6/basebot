import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { ParsedMessagePlaintextOpts } from '../parser';
import { SlackDataStore } from '../../utils/slack-data-store';

export class ChannelLinkSection {
  type: 'channel_link' = 'channel_link';
  channelId: string;
  label?: string;

  constructor(initial?: { channelId?: string; label?: string }) {
    this.channelId = initial?.channelId || '';
    this.label = initial?.label;
  }

  async plainText(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    teamId: string,
    client?: WebClient,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts?: ParsedMessagePlaintextOpts,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    slackDataStore?: SlackDataStore,
  ): Promise<string> {
    if (this.label) {
      return this.label;
    }

    if (!client) {
      return this.channelId;
    }

    try {
      const res = await client.conversations.info({ channel: this.channelId });
      if (res.error || !res.ok) {
        throw new Error(`error returned from conversations.info: ${res.error}`);
      }

      if (!res.channel) {
        throw new Error(`error returned from conversations.info: not found`);
      }

      if (!res.channel.name) {
        throw new Error(
          `error returned from conversations.info: no name found`,
        );
      }

      return res.channel.name;
    } catch (error) {
      logger.error({
        msg: `failed to fetch channel data for ${this.channelId}`,
        error: error.stack,
      });

      return this.channelId; // Default to returning the channel ID
    }
  }
}
