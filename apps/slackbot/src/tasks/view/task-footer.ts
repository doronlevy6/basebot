import { MessageBlocks } from '../manager';
import { ITaskViewProps } from './types';
import { UserLink } from './user-link';

export const TaskFooter = ({ creator }: ITaskViewProps): MessageBlocks => {
  return {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Check out Base yourself. See this task the way ${UserLink(
          creator.id,
        )} and the entire team sees it - easily update, or add new activities & tasks yourself. <${'https://link.base.la'}|download app>.`,
      },
    ],
  };
};
