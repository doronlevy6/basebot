import { MessageBlocks } from '../manager';
import { ITaskViewProps } from './types';
import { UserLink } from './user-link';

export const TaskHeaderText = ({
  assignee,
  creator,
}: ITaskViewProps): string => {
  return `Hi ${UserLink(assignee.id)}, ${UserLink(
    creator.id,
  )} has invited you to collaborate using Base.`;
};

export const TaskHeaderBlock = (props: ITaskViewProps): MessageBlocks => {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: [
        TaskHeaderText(props),
        `Base is a first of it's kind tool built for managers to help run their teams better.
      \n${UserLink(
        props.creator.id,
      )} added you as a contributor on the following:`,
      ].join('\n'),
    },
  };
};
