import { MessageBlocks } from '../manager';
import { SlackMessageSenderMetadata } from '../types';
import { AcknowledgeAction } from './acknowledge-action';
import { AddLinkActionBlock } from './add-link-action-block';
import { StatusActionBlocks } from './status-action-block';
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
    TaskDetails(props),
  ];

  if (acknowledgementStatus) {
    messageBlocks.push(...StatusActionBlocks(props));
    messageBlocks.push(AddLinkActionBlock(props));
  }

  messageBlocks.push(TaskFooter(props));

  return messageBlocks;
};
