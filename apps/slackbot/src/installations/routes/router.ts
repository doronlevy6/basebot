import { SlackbotApiApi as SlackbotApi } from '@base/oapigen';
import { App } from '@slack/bolt';
import { EventsHandler } from '../../handlers/events-handler';

export enum SlackBotRoutes {
  TASK_STATUS_SELECT = 'task-status-select',
  MODAL_SUBMIT = 'settings-submit',
  MESSAGE_SUBMIT = 'message-submit-action',
  MESSAGE_FEEDBACK = 'overflow-action',
}

export const registerSlackbotEvents = (app: App, baseApi: SlackbotApi) => {
  const eventsHandler = new EventsHandler(baseApi);
  app.action(
    SlackBotRoutes.TASK_STATUS_SELECT,
    eventsHandler.handleSelectTaskStatus,
  );
};
