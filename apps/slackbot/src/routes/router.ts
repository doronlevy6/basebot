import { SlackbotApiApi as SlackbotApi } from '@base/oapigen';
import { App } from '@slack/bolt';
import { addLinkHandler } from '../handlers/collaterals/add-link-handler';
import { AddLinkModal } from '../handlers/collaterals/add-link-modal';

import { EventsHandler } from '../handlers/events-handler';
import { taskStatusUpdateHandler } from '../handlers/status/task-status-update-handler';
import { TaskStatusUpdateModal } from '../handlers/status/task-status-update-modal';

export enum SlackBotRoutes {
  TASK_STATUS_MODAL = 'task-status-modal',
  TASK_STATUS_SUBMIT = 'task-status-submit',
  CREATE_TASK = 'create_tasks',
  CREATE_TASKS_SUBMIT = 'create-tasks-submit',
  ADD_TASK_LINK_MODAL = 'add-task-link-modal',
  ADD_TASK_LINK = 'enter-task-link',
  OAUTH_CONNECT = 'add-links-oauth-submit',
  TASK_ACKNOWLEDGE_SELECT = 'task-acknowledge',
}

export const registerSlackbotEvents = (app: App, baseApi: SlackbotApi) => {
  const eventsHandler = new EventsHandler(baseApi);
  app.view(SlackBotRoutes.TASK_STATUS_SUBMIT, taskStatusUpdateHandler(baseApi));
  app.action(/task-acknowledge.*/, eventsHandler.handleTaskAcknowledge);
  app.shortcut(SlackBotRoutes.CREATE_TASK, eventsHandler.handleCreateTask);
  app.view(SlackBotRoutes.CREATE_TASKS_SUBMIT, eventsHandler.submitCreateTasks);
  app.view(SlackBotRoutes.OAUTH_CONNECT, onlyAck);
  app.action(SlackBotRoutes.ADD_TASK_LINK_MODAL, AddLinkModal());
  app.view(SlackBotRoutes.ADD_TASK_LINK, addLinkHandler(baseApi));
  app.action(SlackBotRoutes.TASK_STATUS_MODAL, TaskStatusUpdateModal());

  // This is the global action handler, which will match all unmatched actions
  app.action(/.*/, onlyAck);
};

const onlyAck = async ({ ack }) => {
  await ack();
};
