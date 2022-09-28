import { logger } from '@base/logger';
import { Job, Worker } from 'bullmq';
import { createQueueWorker, IQueueConfig } from '@base/queues';
import { PgInstallationStore } from '../installations/installationStore';
import { NudgeMessageDto } from '@base/oapigen';
import { WebClient } from '@slack/web-api';
import { IConvStore } from '../db/conv-store';
import { UserLink } from '../tasks/view/user-link';

export class NudgeManager {
  private queueCfg: IQueueConfig;
  private nudgeWorker: Worker;
  private installationStore: PgInstallationStore;
  private convStore: IConvStore;

  constructor(
    queueCfg: IQueueConfig,
    installationStore: PgInstallationStore,
    convStore: IConvStore,
  ) {
    this.queueCfg = queueCfg;
    this.installationStore = installationStore;
    this.convStore = convStore;
  }

  async isReady(): Promise<boolean> {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    this.nudgeWorker = createQueueWorker(
      'slackNudge',
      this.queueCfg,
      async (job) => {
        await this.sendNudge(job);
      },
    );

    for (let i = 0; i < 10; i++) {
      try {
        await (await this.nudgeWorker.client).ping();
        return true;
      } catch (error) {
        logger.error(`error pinging the queues: ${error}`);
      }
      await delay(1000 * i); // Wait for (number of seconds * loop number) so that we try a few times before giving up
    }

    return false;
  }

  async close() {
    await this.nudgeWorker.close();
  }

  private async sendNudge(job: Job<NudgeMessageDto>) {
    try {
      const {
        comment,
        organizationId,
        taskId,
        userToNudgeEmail,
        actionUserEmail,
      } = job.data;
      const installation =
        await this.installationStore.fetchInstallationByBaseId(organizationId);
      const client = new WebClient(installation.bot?.token);

      const lookupByEmails = [
        client.users.lookupByEmail({
          email: userToNudgeEmail,
        }),
        client.users.lookupByEmail({
          email: actionUserEmail,
        }),
      ];
      const [nudgeUserRes, actionUserRes] = await Promise.all(lookupByEmails);
      if (nudgeUserRes.error || !nudgeUserRes.user?.id || !nudgeUserRes.ok) {
        throw new Error(
          `Error getting user to nudge by email in slack: ${nudgeUserRes.error}`,
        );
      }
      if (actionUserRes.error || !actionUserRes.user?.id || !actionUserRes.ok) {
        throw new Error(
          `Error getting action user executed nudge by email in slack: ${actionUserRes.error}`,
        );
      }

      const messageTs = await this.convStore.get({
        taskId,
        baseOrgId: organizationId,
        slackUserId: nudgeUserRes.user.id,
      });
      if (!messageTs) {
        throw new Error(
          `message ts not found for nudge for user ${userToNudgeEmail}`,
        );
      }

      logger.debug({ msg: 'Sending nudge msg', c: nudgeUserRes.user.id, job });
      const nudgeMsgText = this.generateNudgeMsgText(
        actionUserRes.user.id,
        comment,
      );
      await client.chat.postMessage({
        channel: nudgeUserRes.user.id,
        reply_broadcast: true,
        thread_ts: messageTs,
        text: nudgeMsgText,
      });

      logger.info({ msg: 'send task status request', job: job.data });
    } catch (e) {
      logger.error({ msg: 'error sending message', data: job.data, error: e });
    }
  }

  generateNudgeMsgText = (actionUserSlackId: string, comment: string) => {
    let text = `${UserLink(
      actionUserSlackId,
    )}, requested an update on this task`;

    if (comment) {
      text += `:\n${comment}`;
    }
    return text;
  };
}
