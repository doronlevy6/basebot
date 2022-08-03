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
  const { task, acknowledgementStatus } = props;

  const messageBlocks: MessageBlocks[] = [
    TaskHeaderBlock(props),
    TaskTitleBlock(task.title),
    ...AcknowledgeAction(props),
  ];

  if (acknowledgementStatus) {
    messageBlocks.push(...TaskActions(props));
    messageBlocks.push(TaskDetails(props));
    messageBlocks.push(TaskFooter(props));
  }

  return messageBlocks;
};
