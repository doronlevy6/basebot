import { logger } from '@base/logger';
import { SlackbotApiApi as SlackbotApi, Task } from '@base/oapigen';
import validator from 'validator';
import {
  BlockButtonWrapper,
  BlockPlainTextInputActionWrapper,
  SlackActionWrapper,
  ViewAction,
} from '../../../slackbot/common/types';
import { AnalyticsManager } from '../analytics/analytics-manager';
import { snakeToTitleCase } from '@base/utils';
import { ActionsBlock, SectionBlock, WebClient } from '@slack/web-api';
import { TaskView } from '../tasks/view';
import { AcknowledgementStatus, ITaskViewProps } from '../tasks/view/types';

export class EventsHandler {
  private baseApi: SlackbotApi;

  constructor(baseApi: SlackbotApi) {
    this.baseApi = baseApi;
  }

  handleSelectTaskStatus = async (params: BlockButtonWrapper) => {
    const { body, ack, say } = params;
    await ack();
    try {
      const { organizationId, assigneeId, taskId, status } = JSON.parse(
        body?.actions[0]?.value,
      );

      logger.info(
        `handling task status selecteced for task [${taskId}], assignee [${assigneeId}], status [${status}] `,
      );

      const res = await this.baseApi.slackbotApiControllerUpdate(taskId, {
        assigneeId,
        status,
      });

      if (!res.data.task) {
        throw new Error(`unable to find task with id [${taskId}]`);
      }

      await this.updateTaskAndSendEvent(
        params,
        { assigneeId, task: res.data.task, organizationId },
        { action: 'task_status_update' },
      );
    } catch (e) {
      logger.error({ msg: `error in changing status for for task`, error: e });
      say(`Error in update task status`);
    }
  };

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
        throw new Error(`unable to find task with id [${taskId}]`);
      }

      await this.updateTaskAndSendEvent(
        params,
        { assigneeId, task: res.data.task, organizationId },
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

  handleAddTaskLink = async (params: BlockPlainTextInputActionWrapper) => {
    const { body, ack, say, client } = params;
    await ack();
    const linkUrl = body.actions[0]?.value;
    if (!validator.isURL(linkUrl)) {
      logger.info(`invalid url in task link`);
      say(`Invalid url - please enter a correct link for the task`);
      return;
    }

    try {
      const { assigneeId, taskId, organizationId } = JSON.parse(
        body?.actions[0]?.block_id,
      );
      logger.info(
        `handling adding task link for task [${taskId}], link [${linkUrl}]`,
      );

      const res = await this.baseApi.slackbotApiControllerAddCollateral({
        taskId,
        url: linkUrl,
        assigneeId: assigneeId,
      });

      if (!res.data.task) {
        throw new Error(`unable to find task with id [${taskId}]`);
      }

      this.tryOauthForUser(
        assigneeId,
        organizationId,
        linkUrl,
        body.trigger_id,
        client,
      );

      await this.updateTaskAndSendEvent(
        params,
        {
          assigneeId,
          task: res.data.task,
          organizationId,
        },
        { action: 'add_task_link' },
        { extraCollaterals: [linkUrl] },
      );
    } catch (e) {
      logger.error(`error in changing status for for task`);
      say(`Error in update link for the task`);
    }
  };

  tryOauthForUser = async (
    userId: string,
    orgId: string,
    linkUrl: string,
    triggerId: string,
    client: WebClient,
  ) => {
    try {
      const detectedProvider = this.tryDetectLinkUrl(linkUrl);
      if (!detectedProvider) {
        return;
      }

      const userProviders = await (
        await this.baseApi.slackbotApiControllerGetUserProviders(userId, orgId)
      ).data;

      if (userProviders.includes(detectedProvider)) {
        return;
      }

      const oauthRedirectUrl = (
        await this.baseApi.slackbotApiControllerGenerateOauthRedirect({
          provider: detectedProvider,
          organizationId: orgId,
          userId: userId,
        })
      ).data;

      await client.views.open({
        trigger_id: triggerId,
        view: {
          private_metadata: '',
          callback_id: 'add-links-oauth-submit',
          type: 'modal',
          title: {
            type: 'plain_text',
            text: `Base & ${snakeToTitleCase(detectedProvider)}`,
          },
          close: {
            type: 'plain_text',
            text: 'Connect Later',
          },
          submit: {
            type: 'plain_text',
            text: 'Done',
          },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `Let Base update your progress automatically by connecting ${snakeToTitleCase(
                  detectedProvider,
                )}\n\n`,
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  style: 'primary',
                  text: {
                    type: 'plain_text',
                    text: 'Connect now',
                    emoji: true,
                  },
                  value: 'click_to_open_oauth',
                  url: oauthRedirectUrl,
                  action_id: 'click-to-open-oauth-action',
                },
              ],
            },
          ],
        },
      });
    } catch (error) {
      logger.error({
        msg: `Error creating modal for OAuth Connect`,
        error: error.stack,
      });
    }
  };

  private tryDetectLinkUrl = (linkUrl: string): string | undefined => {
    const parsed = new URL(linkUrl);
    if (parsed.hostname.includes('app.asana.com')) {
      return 'asana';
    }

    if (parsed.hostname.includes('monday.com')) {
      return 'monday';
    }
  };

  private updateTaskAndSendEvent = async (
    {
      client,
      body,
      respond,
    }: BlockButtonWrapper | BlockPlainTextInputActionWrapper,
    data: {
      organizationId: string;
      assigneeId: string;
      task: Task;
    },
    analytics: { action: string; data?: Record<string, string> },
    viewOverrides?: Partial<ITaskViewProps>,
  ) => {
    const { organizationId, assigneeId, task } = data;
    const slackUserId = body.user.id;

    const creator = await client.users.lookupByEmail({
      email: task.creator.email,
    });
    if (!creator.user?.id) {
      logger.error(`Can't update message without creator id`);
      return;
    }

    const taskView = TaskView({
      assignee: {
        id: slackUserId,
      },
      creator: {
        id: creator.user.id,
      },
      baseOrgId: organizationId,
      baseUserId: assigneeId,
      task,
      acknowledgementStatus: AcknowledgementStatus.Acknowledged,
      ...viewOverrides,
    });

    await respond({
      replace_original: true,
      response_type: 'in_channel',
      text: body.message?.text,
      blocks: taskView.blocks,
    });

    const user = await client.users.profile.get({ user: slackUserId });
    if (!user.profile?.email) {
      logger.warn(
        `unable to send user interaction for analytics without user profile`,
      );
      return;
    }
    AnalyticsManager.getInstance().userInteraction(user?.profile.email, {
      action: analytics.action,
      taskId: task.id,
      status: task.status,
      ...analytics.data,
    });
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
