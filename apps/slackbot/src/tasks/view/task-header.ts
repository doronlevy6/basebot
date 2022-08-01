import { MessageBlocks } from '../manager';
import { ITaskViewProps } from './types';
import { UserLink } from './user-link';

export const TaskHeaderText = ({
  assignee,
  creator,
}: ITaskViewProps): string => {
  return `Hi ${UserLink(assignee.id)}, ${UserLink(
    creator.id,
  )} has invited you to collaborate on the following:`;
};

export const TaskHeaderBlock = (props: ITaskViewProps): MessageBlocks => {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: [TaskHeaderText(props)].join('\n\n'),
    },
  };
};
