import { MessageBlocks } from '../manager';
import { ITaskViewProps } from './types';

export const AddLinkActionBlock = ({
  baseOrgId,
  baseUserId,
  task,
}: ITaskViewProps): MessageBlocks => {
  return {
    dispatch_action: true,
    type: 'input',
    block_id: JSON.stringify({
      organizationId: baseOrgId,
      assigneeId: baseUserId,
      taskId: task.id,
    }),
    element: {
      type: 'plain_text_input',
      action_id: 'enter-task-link',
    },
    label: {
      type: 'plain_text',
      text: 'Enter a link to where the task is managed',
      emoji: true,
    },
  };
};
