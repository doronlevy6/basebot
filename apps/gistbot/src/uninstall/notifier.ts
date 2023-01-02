import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { SlackDataStore } from '../utils/slack-data-store';
import { Installation, InstallationStore } from '@slack/bolt';

export class UninstallsNotifier {
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
      process.env.SLACK_UNINSTALLS_NOTIFICATION_CHANNEL_ID ?? 'C04H4ALV0HH';
    this.slackDataStore = slackDataStore;
  }

  async notify(teamId: string, installation: Installation): Promise<void> {
    if (!this.enabled) {
      return;
    }
    try {
      await this.slackClient.chat.postMessage({
        text: `:face_with_head_bandage: theGist uninstall on ${this.env}`,
        channel: this.notificationChannelId,
        attachments: [
          {
            color: 'danger',
            fields: [
              {
                title: 'Team Name',
                value: installation.team?.name || `unknown`,
                short: true,
              },
              {
                title: 'Team Id',
                value: teamId,
                short: true,
              },
            ],
          },
        ],
      });
    } catch (error) {
      logger.error(`error notifying on uninstall: ${error} ${error.stack}`);
    }
  }
}
