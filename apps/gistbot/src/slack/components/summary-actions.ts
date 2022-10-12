import { KnownBlock } from '@slack/web-api';

interface IActionData {
  id: string;
  value?: string;
}
interface IParams {
  addToChannelsAction: IActionData;
  postAction?: IActionData;
}

export const SummaryActions = ({
  postAction,
  addToChannelsAction,
}: IParams): KnownBlock => {
  const elements = [addToChannelActionBlock(addToChannelsAction)];
  if (postAction) {
    elements.unshift(postActionBlock(postAction));
  }
  return {
    type: 'actions',
    elements,
  };
};

const postActionBlock = ({ id, value }: IActionData) => ({
  type: 'button',
  text: {
    type: 'plain_text',
    text: 'Post to channel',
  },
  action_id: id,
  value,
});

const addToChannelActionBlock = ({ id, value }: IActionData) => ({
  type: 'button',
  text: {
    type: 'plain_text',
    text: 'Add me to more channels',
  },
  action_id: id,
  value,
});
