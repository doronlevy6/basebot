import { formatDate, snakeToTitleCase } from '@base/utils';
import { MrkdwnElement, PlainTextElement } from '@slack/web-api';
import { MessageBlocks } from '../manager';
import { ITaskViewProps } from './types';

export const TaskDetails = ({
  task,
  extraCollaterals,
}: ITaskViewProps): MessageBlocks => {
  const detailsFields: (PlainTextElement | MrkdwnElement)[] = [];

  const status: MrkdwnElement = {
    type: 'mrkdwn',
    text: `*Status:*\n${snakeToTitleCase(task.status)}`,
  };

  detailsFields.push(status);

  if (task.dueDate) {
    detailsFields.push({
      type: 'mrkdwn',
      text: `*Due Date:*\n${formatDate(task.dueDate)}`,
    });
  }

  const allCollaterals = [
    ...new Set([
      ...(extraCollaterals ?? []),
      ...(task.collaterals?.map((c) => c.url) ?? []),
    ]),
  ];
  if (allCollaterals.length) {
    const taskLinks = allCollaterals.map((link) => `<${link}|${link}>\n`);
    detailsFields.push({
      type: 'mrkdwn',
      text: `*Links:*\n${taskLinks}`,
    });
  }

  return {
    type: 'section',
    block_id: 'task-general-details',
    fields: detailsFields,
  };
};
