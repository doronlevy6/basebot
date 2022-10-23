import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '../analytics/manager';
import { Routes } from '../routes/router';
import { UserLink } from '../slack/components/user-link';

export class UserFeedbackManager {
  private slackClient: WebClient;
  private env: string;

  constructor(
    private analyticsManager: AnalyticsManager,
    env: string,
    botToken: string,
  ) {
    this.env = env;
    this.slackClient = new WebClient(botToken);
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
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: text,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Add a comment',
              },
              value: sessionId,
              action_id: Routes.SEND_USER_FEEDBACK,
            },
          ],
        },
      ],
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
      await this.extractUserProfileDetails(client, userId);

    try {
      this.slackClient.chat.postMessage({
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
    userId: string,
  ): Promise<{
    email: string;
    userName: string;
    displayName: string;
    tz: string;
  }> {
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
