import { MessageBlocks } from '../manager';
import { ITaskViewProps } from './types';
import { UserLink } from './user-link';

const DOWNLOAD_LINK = 'https://www.base.la/subsribe-to-beta';

export const TaskFooter = ({ creator }: ITaskViewProps): MessageBlocks => {
  return {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Check out Base yourself. See this task the way ${UserLink(
          creator.id,
        )} and the entire team sees it - easily update, or add new activities & tasks yourself. <${DOWNLOAD_LINK}|download app>.`,
      },
    ],
  };
};
