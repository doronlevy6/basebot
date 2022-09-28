import { SlackbotApiApi as SlackbotApi } from '@base/oapigen';
import { App } from '@slack/bolt';
import { IConvStore } from '../db/conv-store';
import { addLinkHandler } from '../handlers/collaterals/add-link-handler';
import { AddLinkModal } from '../handlers/collaterals/add-link-modal';
import { addDiscussionHandler } from '../handlers/discussions/add-discussion-handler';
import { AddDiscussionModal } from '../handlers/discussions/add-discussion-modal';

import { EventsHandler } from '../handlers/events-handler';
import { taskStatusUpdateHandler } from '../handlers/status/task-status-update-handler';
import { TaskStatusUpdateModal } from '../handlers/status/task-status-update-modal';

export enum SlackBotRoutes {
  TASK_STATUS_MODAL = 'task-status-modal',
  TASK_STATUS_SUBMIT = 'task-status-submit',
  CREATE_TASK = 'create_tasks',
  CREATE_TASKS_SUBMIT = 'create-tasks-submit',
  ADD_DISCUSSION = 'add-discussion',
  ADD_DISCUSSION_SUBMIT = 'add-discussion-submit',
  ADD_TASK_LINK_MODAL = 'add-task-link-modal',
  ADD_TASK_LINK = 'enter-task-link',
  ADD_TASK_LINK_COMMENT = 'enter-task-link-comment',
  OAUTH_CONNECT = 'add-links-oauth-submit',
  TASK_ACKNOWLEDGE_SELECT = 'task-acknowledge',
  SUMMARIZE_THREAD = 'summarize-thread',
}

export const registerSlackbotEvents = (
  app: App,
  baseApi: SlackbotApi,
  convStore: IConvStore,
) => {
  const eventsHandler = new EventsHandler(baseApi, convStore);
  app.view(
    SlackBotRoutes.TASK_STATUS_SUBMIT,
    taskStatusUpdateHandler(baseApi, convStore),
  );
  app.action(/task-acknowledge.*/, eventsHandler.handleTaskAcknowledge);
  app.shortcut(SlackBotRoutes.CREATE_TASK, eventsHandler.handleCreateTask);
  app.shortcut(SlackBotRoutes.ADD_DISCUSSION, AddDiscussionModal(baseApi));
  app.shortcut(
    SlackBotRoutes.SUMMARIZE_THREAD,
    eventsHandler.handleSummarizeThread,
  );
  app.view(SlackBotRoutes.ADD_DISCUSSION_SUBMIT, addDiscussionHandler(baseApi));
  app.view(SlackBotRoutes.CREATE_TASKS_SUBMIT, eventsHandler.submitCreateTasks);
  app.view(SlackBotRoutes.OAUTH_CONNECT, onlyAck);
  app.action(SlackBotRoutes.ADD_TASK_LINK_MODAL, AddLinkModal());
  app.view(SlackBotRoutes.ADD_TASK_LINK, addLinkHandler(baseApi, convStore));
  app.action(SlackBotRoutes.TASK_STATUS_MODAL, TaskStatusUpdateModal());

  // This is the global action handler, which will match all unmatched actions
  app.action(/.*/, onlyAck);
};

const onlyAck = async ({ ack }) => {
  await ack();
};
