import { SlackbotApiApi as SlackbotApi } from '@base/oapigen';
import { App } from '@slack/bolt';
import { EventsHandler } from '../slackbot/src/handlers/events-handler';

export enum SlackBotRoutes {
  TASK_STATUS_SELECT = 'task-status-select',
  CREATE_TASK = 'create_tasks',
  CREATE_TASKS_SUBMIT = 'create-tasks-submit',
  ADD_TASK_LINK = 'enter-task-link',
}

export const registerSlackbotEvents = (app: App, baseApi: SlackbotApi) => {
  const eventsHandler = new EventsHandler(baseApi);
  app.action(
    SlackBotRoutes.TASK_STATUS_SELECT,
    eventsHandler.handleSelectTaskStatus,
  );
  app.shortcut(SlackBotRoutes.CREATE_TASK, eventsHandler.handleCreateTask);
  app.view(SlackBotRoutes.CREATE_TASKS_SUBMIT, eventsHandler.submitCreateTasks);
  app.action(SlackBotRoutes.ADD_TASK_LINK, eventsHandler.handleAddTaskLink);
};
