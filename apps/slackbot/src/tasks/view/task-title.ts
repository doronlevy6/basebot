import { MessageBlocks } from '../manager';

export const TaskTitleBlock = (title: string): MessageBlocks => {
  return {
    type: 'header',
    text: {
      type: 'plain_text',
      text: title,
      emoji: true,
    },
  };
};
