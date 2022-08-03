import { logger } from '@base/logger';
import { SlackbotApiApi } from '@base/oapigen';
import { ViewAction } from '../../../common/types';
import { SlackBotRoutes } from '../../routes/router';
import { IModalMetadata } from '../types';
import { updateTaskAndSendEvent } from '../update-task-message';

export const taskStatusUpdateHandler =
  (baseApi: SlackbotApiApi) => async (params: ViewAction) => {
    const { body, ack, view } = params;
    await ack();

    try {
      const { messageTs, channelId, assigneeId, organizationId, taskId } =
        JSON.parse(view.private_metadata) as IModalMetadata;

      const viewState = Object.values(body.view.state.values)[0][
        SlackBotRoutes.TASK_STATUS_SUBMIT
      ];
      const { status } = JSON.parse(viewState.selected_option?.value ?? '{}');

      logger.info(
        `handling task status selecteced for task [${taskId}], assignee [${assigneeId}], status [${status}] `,
      );

      const res = await baseApi.slackbotApiControllerUpdate(taskId, {
        assigneeId,
        status,
      });

      if (!res.data.task) {
        logger.error(`unable to update message with no task`);
        return;
      }

      await updateTaskAndSendEvent(
        params,
        {
          organizationId,
          assigneeId,
          task: res.data.task,
          messageTs,
          channelId,
        },
        { action: 'status_update', data: { status } },
      );
    } catch (err) {
      logger.error(`Failed handling status update: ${err}`);
    }
  };
