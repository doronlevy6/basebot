import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';

export class UserGroupMentionSection {
  type: 'user_group_mention' = 'user_group_mention';
  userGroupId: string;
  label?: string;

  constructor(initial?: { userGroupId?: string; label?: string }) {
    this.userGroupId = initial?.userGroupId || '';
    this.label = initial?.label;
  }

  async plainText(teamId: string, client?: WebClient): Promise<string> {
    if (this.label) {
      return `@${this.label}`;
    }

    if (!client) {
      return `@${this.userGroupId}`;
    }

    try {
      const res = await client.usergroups.list({ team_id: teamId });
      if (res.error || !res.ok) {
        throw new Error(`error returned from usergroups.list: ${res.error}`);
      }

      if (!res.usergroups) {
        throw new Error(`error returned from usergroups.list: not found`);
      }

      const usergroup = res.usergroups.find((ug) => ug.id === this.userGroupId);
      if (!usergroup || !usergroup.handle) {
        throw new Error(`error returned from usergroups.list: no match found`);
      }

      return `@${usergroup.handle}`;
    } catch (error) {
      logger.error({
        msg: `failed to fetch user group data for ${this.userGroupId}`,
        error: error.stack,
      });

      return `@${this.userGroupId}`; // Default to returning the user group ID
    }
  }
}
