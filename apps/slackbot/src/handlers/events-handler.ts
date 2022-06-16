import { logger } from '@base/logger';
import { SlackbotApiApi as SlackbotApi } from '@base/oapigen';
import { BlockStaticSelectWrapper } from '../../../slackbot/common/types';

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
      this.baseApi.slackbotApiControllerUpdate(taskId, { assigneeId, status });
    } catch (e) {
      logger.error(`error in changing status for for task`);
    }
  };
}
