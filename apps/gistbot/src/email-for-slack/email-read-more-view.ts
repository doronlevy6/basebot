import { ModalView } from '@slack/web-api';
interface IProps {
  title;
  body;
}

export const ReadMoreView: (props: IProps) => ModalView = ({ title, body }) => {
  return {
    type: 'modal',
    close: {
      type: 'plain_text',
      text: 'Done',
      emoji: true,
    },
    title: {
      type: 'plain_text',
      text: title,
      emoji: true,
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: body,
        },
      },
    ],
  };
};
