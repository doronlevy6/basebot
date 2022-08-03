import { Button } from '@slack/web-api';
import { SlackBotRoutes } from '../../routes/router';
import { MessageBlocks } from '../manager';
import { AcknowledgementStatus, ITaskViewProps } from './types';

export const AcknowledgeAction = (props: ITaskViewProps): MessageBlocks[] => {
  const { acknowledgementStatus } = props;
  const acknowledgeButton = Button(
    `I'm on it`,
    AcknowledgementStatus.Acknowledged,
    acknowledgementStatus === AcknowledgementStatus.Acknowledged
      ? 'primary'
      : undefined,
    props,
  );

  const declineButton = Button(
    'Decline',
    AcknowledgementStatus.Declined,
    acknowledgementStatus === AcknowledgementStatus.Declined
      ? 'danger'
      : undefined,
    props,
  );

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Please reply by choosing any of the following:`,
      },
    },
    {
      type: 'actions',
      elements: [acknowledgeButton, declineButton],
      block_id: 'acknowledge-buttons',
    },
  ];
};

const Button = (
  text: string,
  actionId: string,
  style: string | undefined,
  { baseOrgId, baseUserId, task }: ITaskViewProps,
) => ({
  type: 'button',
  text: {
    type: 'plain_text',
    text,
    emoji: true,
  },
  style,
  value: JSON.stringify({
    organizationId: baseOrgId,
    assigneeId: baseUserId,
    taskId: task.id,
    actionId,
  }),
  action_id: SlackBotRoutes.TASK_ACKNOWLEDGE_SELECT + '-' + actionId,
});
