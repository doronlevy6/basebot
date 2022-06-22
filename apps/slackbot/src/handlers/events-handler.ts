import { logger } from '@base/logger';
import { SlackbotApiApi as SlackbotApi } from '@base/oapigen';
import {
  BlockPlainTextInputActionWrapper,
  BlockStaticSelectWrapper,
} from '../../../slackbot/common/types';
import validator from 'validator';
export class EventsHandler {
  private baseApi: SlackbotApi;

  constructor(baseApi: SlackbotApi) {
    this.baseApi = baseApi;
  }

  handleSelectTaskStatus = async ({
    body,
    ack,
    say,
  }: BlockStaticSelectWrapper) => {
    await ack();
    try {
      const { assigneeId, taskId, status } = JSON.parse(
        body?.actions[0]?.selected_option?.value,
      );
      logger.info(
        `handling task status selecteced for task [${taskId}], assignee [${assigneeId}], status [${status}] `,
      );
      say(
        `Thanks for the update! We will update the task status to be ${status}`,
      );
      await this.baseApi.slackbotApiControllerUpdate(taskId, {
        assigneeId,
        status,
      });
    } catch (e) {
      logger.error(`error in changing status for for task`);
      say(`Error in update task status`);
    }
  };

  handleAddTaskLink = async ({
    body,
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
      await this.baseApi.slackbotApiControllerCreateExternalResource({
        taskId,
        url: linkUrl,
        assigneeId: assigneeId,
      });
      say(`Thanks for the update! We will update the task links`);
    } catch (e) {
      logger.error(`error in changing status for for task`);
      say(`Error in update link for the task`);
    }
  };
}
