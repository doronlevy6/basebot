import { logger } from '@base/logger';
import { Job, Worker } from 'bullmq';
import { createQueueWorker, IQueueConfig } from '@base/queues';
import { Block, WebClient } from '@slack/web-api';
import { PgInstallationStore } from '../installations/installationStore';
import { MessengerMessage } from '@base/oapigen';

export class Messenger {
  private queueCfg: IQueueConfig;
  private messageSenderWorker: Worker;
  private installationStore: PgInstallationStore;

  constructor(queueCfg: IQueueConfig, installationStore: PgInstallationStore) {
    this.queueCfg = queueCfg;
    this.installationStore = installationStore;
  }

  async isReady(): Promise<boolean> {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    this.messageSenderWorker = createQueueWorker(
      'slackMessenger',
      this.queueCfg,
      async (job) => {
        await this.sendMessage(job);
      },
    );

    for (let i = 0; i < 10; i++) {
      try {
        await (await this.messageSenderWorker.client).ping();
        return true;
      } catch (error) {
        logger.error(`error pinging the queues: ${error}`);
      }
      await delay(1000 * i); // Wait for (number of seconds * loop number) so that we try a few times before giving up
    }

    return false;
  }

  async close() {
    await this.messageSenderWorker.close();
  }

  private async sendMessage(job: Job<MessengerMessage>) {
    const message = job.data;

    if (!message.userEmail && !message.channelId) {
      throw new Error('no user email and no channel id given to send message');
    }

    if (!message.text && !message.blocks) {
      throw new Error(
        'no message text and no message blocks given to send message',
      );
    }

    const installation = await this.installationStore.fetchInstallationByBaseId(
      message.organizationId,
    );
    const client = new WebClient(installation.bot.token);

    if (message.userEmail) {
      await this.sendToUser(client, message);
      return;
    }

    await client.chat.postMessage({
      channel: job.data.channelId,
      text: job.data.text,
      blocks: job.data.blocks as Block[],
    });

    logger.info({ msg: 'send message request', job: job.data });
  }

  private async sendToUser(client: WebClient, message: MessengerMessage) {
    const slackUserRes = await client.users.lookupByEmail({
      email: message.userEmail,
    });
    if (slackUserRes.error) {
      throw new Error(
        `Error getting slack user by email when sending message: ${slackUserRes.error}`,
      );
    }

    if (!slackUserRes.ok) {
      throw new Error(`Error getting slack user by email when sending message`);
    }

    await client.chat.postMessage({
      channel: slackUserRes.user.id,
      text: message.text,
      blocks: message.blocks as Block[],
    });
  }
}
