import { logger } from '@base/logger';
import { TaskStatusEnum } from '@base/oapigen';
import { snakeToTitleCase } from '@base/utils';
import { PlainTextOption } from '@slack/web-api';
import { BlockButtonWrapper } from '../../../common/types';
import { AnalyticsManager } from '../../analytics/analytics-manager';
import { SlackBotRoutes } from '../../routes/router';
import { IModalMetadata, ITaskIdentifier } from '../types';

export const TaskStatusUpdateModal =
  () =>
  async ({ ack, client, body }: BlockButtonWrapper) => {
    try {
      await ack();

      const { message, channel } = body;
      if (!message?.ts || !channel?.id) {
        logger.error({
          msg: "Can't update slack message with out id or channel",
          body,
        });
        return;
      }

      const { organizationId, assigneeId, taskId } = JSON.parse(
        body?.actions[0]?.value,
      ) as ITaskIdentifier;

      logger.info(
        `handling task status modal for [${taskId}], assignee [${assigneeId}] `,
      );

      const statuses: PlainTextOption[] = Object.values(TaskStatusEnum).map(
        (status) => ({
          text: {
            type: 'plain_text',
            text: snakeToTitleCase(status),
            emoji: true,
          },
          value: JSON.stringify({
            status: status,
          }),
        }),
      );

      const metadata: IModalMetadata = {
        messageTs: message.ts,
        channelId: channel.id,
        organizationId,
        assigneeId,
        taskId,
      };

      // TODO: get task status and render the status

      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          private_metadata: JSON.stringify(metadata),
          type: 'modal',
          callback_id: SlackBotRoutes.TASK_STATUS_SUBMIT,
          submit: {
            type: 'plain_text',
            text: 'Submit',
          },
          clear_on_close: true,
          close: {
            type: 'plain_text',
            text: 'Cancel',
          },
          title: {
            type: 'plain_text',
            text: 'Update task status',
          },
          blocks: [
            {
              type: 'input',
              block_id: 'task_status',
              element: {
                type: 'static_select',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select status',
                  emoji: true,
                },
                options: statuses,
                action_id: SlackBotRoutes.TASK_STATUS_SUBMIT,
              },
              label: {
                type: 'plain_text',
                text: ' ',
                emoji: true,
              },
            },
          ],
        },
      });

      AnalyticsManager.getInstance().modalView(
        'task_status_update',
        assigneeId,
        { taskId },
      );
    } catch (error) {
      logger.error(error);
    }
  };
