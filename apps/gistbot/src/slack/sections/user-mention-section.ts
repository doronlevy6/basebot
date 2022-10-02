import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';

export class UserMentionSection {
  type: 'user_mention';
  userId: string;
  label?: string;

  constructor(initial?: { userId?: string; label?: string }) {
    this.userId = initial?.userId || '';
    this.label = initial?.label;
  }

  async plainText(teamId: string, client?: WebClient): Promise<string> {
    if (this.label) {
      return `@${this.label}`;
    }

    if (!client) {
      return `@${this.userId}`;
    }

    try {
      const res = await client.users.info({ user: this.userId });
      if (res.error || !res.ok) {
        throw new Error(`error returned from users.info: ${res.error}`);
      }

      if (!res.user) {
        throw new Error(`error returned from users.info: not found`);
      }

      if (!res.user.name) {
        throw new Error(`error returned from users.info: no name found`);
      }

      const capitalizedName =
        res.user.name.charAt(0).toUpperCase() + res.user.name.slice(1);
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
