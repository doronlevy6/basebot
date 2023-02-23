import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { Installation } from '@slack/bolt';

const registrationBotToken = process.env.SLACK_REGISTRATIONS_BOT_TOKEN;
const newOrganizatinChannel =
  process.env.SLACK_INSTALLS_NOTIFICATION_CHANNEL_ID;
export async function installNotify(installation: Installation): Promise<void> {
  if (!installation) {
    logger.error(`Invalid input: installation is undefined or null`);
    return;
  }
  const org = installation;

  if (!registrationBotToken) {
    logger.error(`Missing environment variable: SLACK_BOT_TOKEN`);
    return;
  }
  try {
    const gistClient = new WebClient(registrationBotToken);
    await gistClient.chat.postMessage({
      channel: newOrganizatinChannel || 'C04PC3S3LEA',
      text: '🎉 TheGist has been installed by a new organization',
      attachments: [
        {
          color: 'good',
          fields: [
            {
              title: 'Team Name',
              value: org.team?.name || `unknown`,
              short: true,
            },
            {
              title: 'Team Id',
              value: org?.team?.id || `unknown`,
              short: true,
            },
          ],
        },
      ],
    });
  } catch (error) {
    logger.error(`Error notifying on organization install:  ${error}`);
  }
}
