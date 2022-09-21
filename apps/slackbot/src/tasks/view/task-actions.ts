import { SlackBotRoutes } from '../../routes/router';
import { MessageBlocks } from '../manager';
import { ITaskViewProps } from './types';

export const TaskActions = (props: ITaskViewProps): MessageBlocks[] => {
  const { baseOrgId, baseUserId, task } = props;
  const updateStatusButton = {
    type: 'button',
    text: {
      type: 'plain_text',
      text: 'Change task status',
    },
    value: JSON.stringify({
      organizationId: baseOrgId,
      assigneeId: baseUserId,
      taskId: task.id,
    }),
    action_id: SlackBotRoutes.TASK_STATUS_MODAL,
  };

  const addLinkButton = {
    type: 'button',
    text: {
      type: 'plain_text',
      text: 'Add related links or docs',
    },
    value: JSON.stringify({
      organizationId: baseOrgId,
      assigneeId: baseUserId,
      taskId: task.id,
    }),
    action_id: SlackBotRoutes.ADD_TASK_LINK_MODAL,
  };

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Do you have anything to add to this task?\n\n Once you connect to tickets in any tool you may use, Base will automatically sync the team when important updates occur, so you don't need to. Base app will let you know about important updates`,
      },
    },
    {
      type: 'actions',
      elements: [addLinkButton, updateStatusButton],
      block_id: 'task-actions',
    },
  ];
};
