import { TaskStatusEnum } from '@base/oapigen';
import { snakeToTitleCase } from '@base/utils';
import { Button } from '@slack/web-api';
import { MessageBlocks } from '../manager';
import { ITaskViewProps } from './types';

export const StatusActionBlocks = ({
  baseOrgId,
  baseUserId,
  task,
}: ITaskViewProps): MessageBlocks[] => {
  const buttons = Object.values(TaskStatusEnum)
    .map((status) => {
      const button: Button = {
        type: 'button',
        text: {
          type: 'plain_text',
          text: snakeToTitleCase(status),
          emoji: true,
        },
        value: JSON.stringify({
          organizationId: baseOrgId,
          assigneeId: baseUserId,
          taskId: task.id,
          status: status,
        }),
        action_id: `task-status-select-${status}`,
        style: status === task.status ? 'primary' : undefined,
      };

      return button;
    })
    .filter((b) => b) as Button[];

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'What is the current status of this task?',
      },
    },
    {
      type: 'actions',
      elements: buttons,
      block_id: 'status-update-buttons',
    },
  ];
};
