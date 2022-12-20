import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { ParsedMessagePlaintextOpts } from '../parser';
import { SlackDataStore } from '../../utils/slack-data-store';

export class UserMentionSection {
  type: 'user_mention' = 'user_mention';
  userId: string;
  label?: string;

  constructor(initial?: { userId?: string; label?: string }) {
    this.userId = initial?.userId || '';
    this.label = initial?.label;
  }

  async plainText(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    teamId: string,
    client?: WebClient,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts?: ParsedMessagePlaintextOpts,
    slackDataStore?: SlackDataStore,
  ): Promise<string> {
    if (this.label) {
      return `@${this.label}`;
    }

    if (!client) {
      return `@${this.userId}`;
    }

    if (!slackDataStore) {
      return `@${this.userId}`;
    }

    try {
      const res = await slackDataStore.getUserInfoData(
        this.userId,
        teamId,
        client,
      );

      if (!res.name) {
        throw new Error(`error returned from users.info: no name found`);
      }
      const capitalizedName =
        res.name.charAt(0).toUpperCase() + res.name.slice(1);
      return `@${capitalizedName}`;
    } catch (error) {
      logger.error({
        msg: `failed to fetch user data for ${this.userId}`,
        error: error.stack,
      });

      return `@${this.userId}`; // Default to returning the user ID
    }
  }
}
