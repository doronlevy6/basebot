import { checkUserTaskRole, UserTaskRole } from '@base/utils';
import { MessageBlocks } from '../manager';
import { SlackMessageSenderMetadata } from '../types';
import { AcknowledgeAction } from './acknowledge-action';
import { TaskActions } from './task-actions';
import { TaskDetails } from './task-details';
import { TaskFooter } from './task-footer';
import { TaskHeaderBlock, TaskHeaderText } from './task-header';
import { TaskTitleBlock } from './task-title';
import { ITaskViewProps } from './types';

export const TaskView = (props: ITaskViewProps): SlackMessageSenderMetadata => {
  const { baseOrgId, assignee } = props;

  return {
    organizationId: baseOrgId,
    channelId: assignee.id,
    text: TaskHeaderText(props),
    blocks: getFormattedBlocks(props),
  };
};

const getFormattedBlocks = (props: ITaskViewProps): MessageBlocks[] => {
  const { baseUserId, task, acknowledgementStatus } = props;
  const userTaskRole = checkUserTaskRole(baseUserId, task);
  const shouldShowAcknowledge =
    userTaskRole === UserTaskRole.owner ||
    userTaskRole === UserTaskRole.contributor;
  const messageBlocks: MessageBlocks[] = [
    TaskHeaderBlock(props),
    TaskTitleBlock(task.title),
  ];

  if (shouldShowAcknowledge) {
    messageBlocks.push(...AcknowledgeAction(props));
    if (acknowledgementStatus === 'acknowledged') {
      messageBlocks.push(TaskDetails(props));
      messageBlocks.push(...TaskActions(props));
      messageBlocks.push(TaskFooter(props));
    }
  } else {
    messageBlocks.push(...TaskActions(props));
  }

  return messageBlocks;
};
