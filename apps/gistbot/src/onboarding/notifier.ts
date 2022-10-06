import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';

export class UserOnboardedNotifier {
  private slackClient: WebClient | undefined;
  private env: string;

  constructor(env: string, botToken?: string) {
    this.env = env;
    if (botToken) {
      this.slackClient = new WebClient(botToken);
    }
  }

  async notify(
    client: WebClient,
    userId: string,
    teamId: string,
  ): Promise<void> {
    if (!this.slackClient) {
      return;
    }

    try {
      const {
        error: profileError,
        ok: profileOk,
        profile: userProfile,
      } = await client.users.profile.get({
        user: userId,
      });
      if (profileError || !profileOk) {
        throw new Error(`Failed to fetch user profile ${profileError}`);
      }

      if (!userProfile) {
        throw new Error(`Failed to fetch user profile profile not found`);
      }

      const {
        error: infoError,
        ok: infoOk,
        user: userInfo,
      } = await client.users.info({
        user: userId,
      });
      if (infoError || !infoOk) {
        throw new Error(`Failed to fetch user profile ${infoError}`);
      }

      if (!userInfo) {
        throw new Error(`Failed to fetch user profile profile not found`);
      }

      const email = userProfile.email;
      const userName = userInfo.name;
      const displayName =
        userProfile.display_name ||
        userProfile.real_name ||
        userProfile.first_name;

      this.slackClient.chat.postMessage({
        text: `:fire: New User Registered to theGist on ${this.env}: ${
          email || displayName || userName
        }`,
        channel: 'C03S45PEK7Y',
        attachments: [
          {
            color: 'good',
            title: `:fire: New User Registered to theGist`,
            fallback: `New User: ${email || displayName || userName}`,
            fields: [
              {
                title: 'User Name',
                value: userName || `unknown`,
                short: true,
              },
              {
                title: 'Display Name',
                value: displayName || `unknown`,
                short: true,
              },
              {
                title: 'Email',
                value: email || 'unknown',
                short: true,
              },
              {
                title: 'Organization',
                value: teamId,
                short: true,
              },
              {
                title: 'Time Zone',
                value: userInfo.tz || 'unknown',
                short: true,
              },
            ],
          },
        ],
      });
    } catch (error) {
      logger.error(
        `error notifying new user onboarded: ${error} ${error.stack}`,
      );
    }
  }
}
