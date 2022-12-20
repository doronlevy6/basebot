import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { SlackDataStore } from '../utils/slack-data-store';

export class UserOnboardedNotifier {
  private slackClient: WebClient;
  private slackDataStore: SlackDataStore;
  private env: string;
  private notificationChannelId: string;

  constructor(
    env: string,
    botToken: string,
    private enabled: boolean,
    slackDataStore: SlackDataStore,
  ) {
    this.env = env;
    this.slackClient = new WebClient(botToken);
    this.notificationChannelId =
      process.env.SLACK_NEW_USERS_NOTIFICATION_CHANNEL_ID ?? 'C03S45PEK7Y';
    this.slackDataStore = slackDataStore;
  }

  async notify(
    client: WebClient,
    userId: string,
    teamId: string,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const userProfile = await this.slackDataStore.getUserProfileData(
        userId,
        teamId,
        client,
      );

      const userInfo = await this.slackDataStore.getUserInfoData(
        userId,
        teamId,
        client,
      );

      const email = userProfile.email;
      const userName = userInfo.name;
      const displayName =
        userProfile.display_name ||
        userProfile.real_name ||
        userProfile.first_name;

      await this.slackClient.chat.postMessage({
        text: `:fire: New User Registered to theGist on ${this.env}: ${
          email || displayName || userName
        }`,
        channel: this.notificationChannelId,
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
