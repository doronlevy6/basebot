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
import { ActionsBlock, Block, Button, SectionBlock } from '@slack/web-api';

export class EventsHandler {
  private baseApi: SlackbotApi;

  constructor(baseApi: SlackbotApi) {
    this.baseApi = baseApi;
  }

  handleSelectTaskStatus = async ({
    body,
    ack,
    say,
    respond,
    client,
  }: BlockButtonWrapper) => {
    await ack();
    try {
      const { organizationId, assigneeId, taskId, status, firstTime } =
        JSON.parse(body?.actions[0]?.value);
      logger.info(
        `handling task status selecteced for task [${taskId}], assignee [${assigneeId}], status [${status}] `,
      );

      const originalMessageBlocks = body.message?.blocks as Block[];

      let taskDetailsSectionBlockIdx: number | undefined;
      originalMessageBlocks.find((b, idx, _) => {
        if (b.block_id == 'task-general-details') {
          taskDetailsSectionBlockIdx = idx;
          return true;
        }
        return false;
      }) as SectionBlock | undefined;
      if (!taskDetailsSectionBlockIdx) {
        throw new Error(
          'unable to find task details section block when parsing message body',
        );
      }

      const statusSectionBlock = originalMessageBlocks.find((b) => {
        return b.block_id == 'status-and-links';
      }) as SectionBlock | undefined;
      if (!firstTime && !statusSectionBlock?.fields) {
        throw new Error(
          'unable to find status section block when parsing message body',
        );
      }

      if (!firstTime && statusSectionBlock?.fields) {
        for (let i = 0; i < statusSectionBlock.fields.length; i++) {
          const field = statusSectionBlock.fields[i];
          if (field.text.includes('*Status:*')) {
            field.text = `*Status:*\n${snakeToTitleCase(status)}`;
          }
        }
      } else if (firstTime) {
        originalMessageBlocks.splice(taskDetailsSectionBlockIdx + 1, 0, {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Status:*\n${snakeToTitleCase(status)}`,
            },
          ],
          block_id: 'status-and-links',
        } as Block);
      }

      const actionsBlock = originalMessageBlocks.find(
        (b) => b.block_id == 'status-update-buttons',
      ) as ActionsBlock | undefined;
      if (!actionsBlock) {
        throw new Error(
          'unable to find actions block when parsing message body',
        );
      }

      for (let i = 0; i < actionsBlock.elements.length; i++) {
        const button = actionsBlock.elements[i] as Button;
        if (button.value) {
          const value = JSON.parse(button.value);
          value.firstTime = false;
          button.value = JSON.stringify(value);
        }
        if (button.action_id?.includes(status)) {
          button.style = 'primary';
          continue;
        }
        button.style = undefined;
      }

      await this.baseApi.slackbotApiControllerUpdate(taskId, {
        assigneeId,
        status,
      });

      if (firstTime) {
        originalMessageBlocks.push({
          dispatch_action: true,
          type: 'input',
          block_id: JSON.stringify({
            organizationId: organizationId,
            assigneeId: assigneeId,
            taskId: taskId,
          }),
          element: {
            type: 'plain_text_input',
            action_id: 'enter-task-link',
          },
          label: {
            type: 'plain_text',
            text: 'Do you have a link that we can use to help track this task?',
            emoji: true,
          },
        } as Block);
      }

      await respond({
        replace_original: true,
        response_type: 'in_channel',
        text: body.message?.text,
        blocks: originalMessageBlocks,
      });

      const user = await client.users.profile.get({ user: body.user.id });
      if (!user.profile?.email) {
        logger.warn(
          `unable to send user interaction for analytics without user profile`,
        );
        return;
      }
      AnalyticsManager.getInstance().userInteraction(user?.profile.email, {
        action: 'task_status_update',
        taskId,
        status,
      });
    } catch (e) {
      logger.error({ msg: `error in changing status for for task`, error: e });
      say(`Error in update task status`);
    }
  };

  handleAddTaskLink = async ({
    body,
    client,
    ack,
    say,
    respond,
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

      const originalMessageBlocks = body.message?.blocks as Block[];

      const statusAndLinksSectionBlock = originalMessageBlocks.find((b) => {
        return b.block_id == 'status-and-links';
      }) as SectionBlock | undefined;
      if (!statusAndLinksSectionBlock) {
        throw new Error(
          'unable to find status and links section block when parsing message body',
        );
      }
      if (!statusAndLinksSectionBlock.fields) {
        throw new Error(
          'unable to find status and links section block when parsing message body',
        );
      }

      const taskLink = `<${linkUrl}|${linkUrl}>\n`;
      if (statusAndLinksSectionBlock.fields.length === 1) {
        statusAndLinksSectionBlock.fields.push({
          type: 'mrkdwn',
          text: `*Links:*\n${taskLink}`,
        });
      } else {
        statusAndLinksSectionBlock.fields[1].text = `${statusAndLinksSectionBlock.fields[1].text}${taskLink}`;
      }

      await respond({
        replace_original: true,
        response_type: 'in_channel',
        text: body.message?.text,
        blocks: originalMessageBlocks,
      });

      const user = await client.users.profile.get({ user: body.user.id });

      if (!user.profile?.email) {
        logger.warn(
          `unable to send user interaction for analytics without user profile`,
        );
        return;
      }

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
