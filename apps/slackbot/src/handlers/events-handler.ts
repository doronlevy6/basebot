import { logger } from '@base/logger';
import { SlackbotApiApi as SlackbotApi } from '@base/oapigen';
import { ActionsBlock, SectionBlock } from '@slack/web-api';
import {
  BlockButtonWrapper,
  SlackActionWrapper,
  ViewAction,
} from '../../../slackbot/common/types';
import { AnalyticsManager } from '../analytics/analytics-manager';
import { AcknowledgementStatus } from '../tasks/view/types';
import { updateTaskAndSendEvent } from './update-task-message';

export class EventsHandler {
  private baseApi: SlackbotApi;

  constructor(baseApi: SlackbotApi) {
    this.baseApi = baseApi;
  }

  handleTaskAcknowledge = async (params: BlockButtonWrapper) => {
    const { body, ack, say } = params;
    await ack();

    try {
      const { organizationId, assigneeId, taskId, actionId } = JSON.parse(
        body?.actions[0]?.value,
      );
      logger.info(
        `handling task ack for task [${taskId}], assignee [${assigneeId}], status [${actionId}] `,
      );

      const status =
        actionId === AcknowledgementStatus.Declined
          ? AcknowledgementStatus.Declined
          : AcknowledgementStatus.Acknowledged;

      const res = await this.baseApi.slackbotApiControllerAcknowledgeTask({
        userId: assigneeId,
        organizationId,
        taskId,
        acknowledged: status === AcknowledgementStatus.Acknowledged,
      });

      if (!res.data.task) {
        logger.error(`unable to find task with id [${taskId}]`);
        return;
      }

      const { message, channel } = body;
      if (!message || !channel) {
        logger.error("Can't update slack message with out id or channel");
        return;
      }

      await updateTaskAndSendEvent(
        params,
        {
          assigneeId,
          task: res.data.task,
          organizationId,
          channelId: channel.id,
          messageTs: message.ts,
        },
        { action: 'task_acknowledged' },
        { acknowledgementStatus: actionId as AcknowledgementStatus },
      );
    } catch (e) {
      logger.error({
        msg: `error in changing acknowledgement for task`,
        error: e,
      });
      say(`Error in acknowledging task`);
    }
  };

  handleCreateTask = async ({
    shortcut,
    ack,
    client,
    logger,
    payload,
  }: SlackActionWrapper) => {
    try {
      await ack();
      await client.views.open({
        trigger_id: shortcut.trigger_id,
        view: {
          private_metadata: payload.message.text,
          callback_id: 'create-tasks-submit',
          type: 'modal',
          title: {
            type: 'plain_text',
            text: 'Create tasks at base',
          },
          close: {
            type: 'plain_text',
            text: 'Close',
          },
          submit: { type: 'plain_text', text: 'Create tasks' },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Tap "Create tasks" and a draft will be waiting for you in the Base app for review\n\n',
              },
            },
          ],
        },
      });
    } catch (error) {
      logger.error(error);
    }
  };
  submitCreateTasks = async ({ ack, body, payload, client }: ViewAction) => {
    try {
      await ack();
      const user = await client.users.profile.get({ user: body.user.id });
      if (!user.profile?.email) {
        logger.warn(`unable to submit a new task without user profile`);
        return;
      }

      const userEMail = user.profile.email;
      const text = payload.private_metadata;
      const res =
        await this.baseApi.slackbotApiControllerCreateTasksFromSlackMessage({
          email: userEMail,
          text: text,
        });
      AnalyticsManager.getInstance().userCreateDraft(user.profile.email);

      const button: ActionsBlock = {
        type: 'actions',
        elements: [
          {
            type: 'button',
            style: 'primary',
            text: {
              type: 'plain_text',
              text: 'Open The App',
              emoji: true,
            },
            value: 'click_to_open_app',
            url: 'https://link.base.la/tasks/drafts',
            action_id: 'click-to-open-app-action',
          },
        ],
      };

      const textMessage = `We've created a task for you in the system, check out the base app to see all of your tasks!`;

      const section: SectionBlock = {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: textMessage,
        },
      };

      if (res.status >= 200 && res.status <= 299) {
        await client.chat.postMessage({
          channel: body.user.id,
          text: textMessage,
          blocks: [section, button],
        });
      }
    } catch (e) {
      logger.error(e);
    }
  };
}
