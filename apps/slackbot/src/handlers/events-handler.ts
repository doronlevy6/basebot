import { logger } from '@base/logger';
import { SlackbotApiApi as SlackbotApi } from '@base/oapigen';
import {
  BlockPlainTextInputActionWrapper,
  BlockButtonWrapper,
  SlackActionWrapper,
  ViewAction,
} from '../../../slackbot/common/types';
import validator from 'validator';
import { AnalyticsManager } from '../analytics/analytics-manager';
import { snakeToTitleCase } from '@base/utils';

export class EventsHandler {
  private baseApi: SlackbotApi;

  constructor(baseApi: SlackbotApi) {
    this.baseApi = baseApi;
  }

  handleSelectTaskStatus = async ({
    body,
    ack,
    say,
    client,
  }: BlockButtonWrapper) => {
    await ack();
    try {
      const { assigneeId, taskId, status } = JSON.parse(
        body?.actions[0]?.value,
      );
      logger.info(
        `handling task status selecteced for task [${taskId}], assignee [${assigneeId}], status [${status}] `,
      );
      say(
        `Thanks for the update! We will update the task status to be ${snakeToTitleCase(
          status,
        )}`,
      );
      await this.baseApi.slackbotApiControllerUpdate(taskId, {
        assigneeId,
        status,
      });

      const user = await client.users.profile.get({ user: body.user.id });
      AnalyticsManager.getInstance().userInteraction(user.profile.email, {
        action: 'task_status_update',
        taskId,
        status,
      });
    } catch (e) {
      logger.error(`error in changing status for for task`);
      say(`Error in update task status`);
    }
  };

  handleAddTaskLink = async ({
    body,
    client,
    ack,
    say,
  }: BlockPlainTextInputActionWrapper) => {
    await ack();
    const linkUrl = body.actions[0]?.value;
    if (!validator.isURL(linkUrl)) {
      logger.info(`invalid url in task link`);
      say(`Invalid url - please enter a correct link for the task`);
      return;
    }

    try {
      const { assigneeId, taskId } = JSON.parse(body?.actions[0]?.block_id);
      logger.info(
        `handling adding task link for task [${taskId}], link [${linkUrl}]`,
      );

      await this.baseApi.slackbotApiControllerAddCollateral({
        taskId,
        url: linkUrl,
        assigneeId: assigneeId,
      });
      const user = await client.users.profile.get({ user: body.user.id });
      say(`Thanks for the update! We will update the task links`);
      AnalyticsManager.getInstance().userInteraction(user.profile.email, {
        action: 'add_task_link',
      });
    } catch (e) {
      logger.error(`error in changing status for for task`);
      say(`Error in update link for the task`);
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
                text: 'We will create tasks in base for you :grin:\n\n',
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: 'Enter base app to see the tasks',
                },
              ],
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
      const userEMail = user.profile.email;
      const text = payload.private_metadata;
      const res =
        await this.baseApi.slackbotApiControllerCreateTasksFromSlackMessage({
          email: userEMail,
          text: text,
        });
      AnalyticsManager.getInstance().userCreateDraft(user.profile.email);
      if (res.status >= 200 && res.status <= 299) {
        await client.chat.postMessage({
          channel: body.user.id,
          text: `We have received your message, check out base app to see your tasks!`,
        });
      }
    } catch (e) {
      logger.error(e);
    }
  };
}
