import { checkUserTaskRole, UserTaskRole } from '@base/utils';
import { MessageBlocks } from '../manager';
import { ITaskViewProps } from './types';
import { UserLink } from './user-link';

export const TaskHeaderText = (props: ITaskViewProps): string => {
  const userTaskRole = checkUserTaskRole(props.baseUserId, props.task);
  switch (userTaskRole) {
    case UserTaskRole.creatorAndOwner:
      return TaskCreatorAndOwnerHeaderText(props);
    case UserTaskRole.creator:
      return TaskCreatorHeaderText(props);
    case UserTaskRole.owner:
      return TaskOwnerHeaderText(props);
    case UserTaskRole.contributor:
      return TaskContributorHeaderText(props);
  }
};

export const TaskHeaderBlock = (props: ITaskViewProps): MessageBlocks => {
  const userTaskRole = checkUserTaskRole(props.baseUserId, props.task);
  let headerText = '';
  let headerBlockText = '';
  switch (userTaskRole) {
    case UserTaskRole.creatorAndOwner:
      headerText = TaskCreatorAndOwnerHeaderText(props);
      headerBlockText = TaskCreatorAndOwnerHeaderBlockText();
      break;
    case UserTaskRole.creator:
      headerText = TaskCreatorHeaderText(props);
      headerBlockText = TaskCreatorHeaderBlockText(props);
      break;
    case UserTaskRole.owner:
      headerText = TaskOwnerHeaderText(props);
      headerBlockText = TaskOwnerHeaderBlockText();
      break;
    case UserTaskRole.contributor:
      headerText = TaskContributorHeaderText(props);
      headerBlockText = TaskContributorHeaderBlockText();
      break;
  }

  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: [headerText, headerBlockText].join('\n'),
    },
  };
};

const TaskCreatorHeaderText = ({ assignee }: ITaskViewProps): string => {
  return `Hi ${UserLink(
    assignee.id,
  )}, you have just finished creating your task in Base.`;
};

const TaskCreatorHeaderBlockText = ({ owner }: ITaskViewProps): string => {
  if (!owner) {
    throw new Error('no owner id provided for task creator header');
  }
  return `You will now be able monitor everything that is happening with this task\nwithout nagging anyone. Our Slack bot has already approached ${UserLink(
    owner.id,
  )} so he can add more details about it.`;
};

const TaskCreatorAndOwnerHeaderText = (props: ITaskViewProps): string => {
  return TaskCreatorHeaderText(props);
};

const TaskCreatorAndOwnerHeaderBlockText = (): string => {
  return `You will now be able monitor everything that is happening with this task without nagging anyone. Notice that you are the owner of this task`;
};

const TaskOwnerHeaderText = ({ assignee, creator }: ITaskViewProps): string => {
  return `Hi ${UserLink(assignee.id)}, ${UserLink(
    creator.id,
  )} has invited you to collaborate using Base.`;
};

const TaskOwnerHeaderBlockText = (): string => {
  return `You have been assigned as an Owner of a task. The owner is responsible for the task delivery, and Base is here to help manage it easier.`;
};

const TaskContributorHeaderText = ({
  assignee,
  creator,
}: ITaskViewProps): string => {
  return `Hi ${UserLink(assignee.id)}, ${UserLink(
    creator.id,
  )} has invited you to collaborate using Base.`;
};

const TaskContributorHeaderBlockText = (): string => {
  return `As a contributor, you are encouraged to share links to any tool where related work is done.
  Once you connect to tickets in any tool you may use, Base will automatically sync the team when important updates occur, so you don't need to.`;
};
