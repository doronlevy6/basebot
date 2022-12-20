import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '@base/gistbot-shared';
import { FreetextFeedback } from '../slack/components/freetext-feedback';
import { UserLink } from '../slack/components/user-link';
import { SlackDataStore } from '../utils/slack-data-store';

export class UserFeedbackManager {
  private slackClient: WebClient;
  private env: string;
  private slackDataStore: SlackDataStore;

  constructor(
    private analyticsManager: AnalyticsManager,
    env: string,
    botToken: string,
    slackDataStore: SlackDataStore,
  ) {
    this.env = env;
    this.slackClient = new WebClient(botToken);
    this.slackDataStore = slackDataStore;
  }

  async askForFeedback(
    client: WebClient,
    channelId: string,
    userId: string,
    sessionId: string,
    threadTs?: string,
  ): Promise<void> {
    const text = `Thanks for your feedback ${UserLink(
      userId,
    )}! Would you like to add a comment, feature request or say anything to us?`;
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      thread_ts: threadTs,
      text: text,
      blocks: FreetextFeedback(text, sessionId),
    });
  }

  async sendUserFeedback(
    client: WebClient,
    userId: string,
    teamId: string,
    sessionId: string,
    feedback: string,
  ): Promise<void> {
    const { email, displayName, userName, tz } =
      await this.extractUserProfileDetails(client, teamId, userId);

    try {
      await this.slackClient.chat.postMessage({
        text: `:exclamation: New Feedback for theGist on ${this.env}: ${
          email || displayName || userName
        }`,
        channel: 'C046DRKDF0A',
        attachments: [
          {
            color: 'good',
            title: `:exclamation: New Feedback for theGist`,
            fallback: `New Feedback: ${email || displayName || userName}`,
            fields: [
              {
                title: 'User ID',
                value: userId,
                short: true,
              },
              {
                title: 'User Name',
                value: userName,
                short: true,
              },
              {
                title: 'Display Name',
                value: displayName,
                short: true,
              },
              {
                title: 'Email',
                value: email,
                short: true,
              },
              {
                title: 'Organization',
                value: teamId,
                short: true,
              },
              {
                title: 'Time Zone',
                value: tz,
                short: true,
              },
              {
                title: 'Session ID',
                value: sessionId,
                short: true,
              },
              {
                title: 'Feedback',
                value: feedback,
                short: false,
              },
            ],
          },
        ],
      });
    } catch (error) {
      logger.error(`error sending user feedback: ${error} ${error.stack}`);
    }
  }

  private async extractUserProfileDetails(
    client: WebClient,
    teamId: string,
    userId: string,
  ): Promise<{
    email: string;
    userName: string;
    displayName: string;
    tz: string;
  }> {
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

      return {
        email: email || 'Unknown Email',
        userName: userName || 'Unknown User Name',
        displayName: displayName || 'Unknown Display Name',
        tz: userInfo.tz || 'Unknown TimeZone',
      };
    } catch (error) {
      logger.error({
        msg: `failed to fetch user profile details for feedback`,
        error: error,
      });
      return {
        email: 'Unknown Email',
        userName: 'Unknown User Name',
        displayName: 'Unknown Display Name',
        tz: 'Unknown TimeZone',
      };
    }
  }
}
