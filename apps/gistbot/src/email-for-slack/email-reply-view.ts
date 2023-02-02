import { ModalView } from '@slack/web-api';
interface IProps {
  metadata?: string;
  submitCallback: string;
  userInput?: string;
  address?: string;
}

const replies = ['Great!', 'Sounds good, lets Sync about that later'];
const repliesBlocks = replies.map((reply) => {
  return {
    text: {
      type: 'plain_text',
      text: reply,
      emoji: true,
    },
    value: reply,
  };
});
export const ReplyMailView: (props: IProps) => ModalView = ({
  metadata,
  submitCallback,
  address,
}) => {
  return {
    type: 'modal',
    private_metadata: metadata,
    callback_id: submitCallback,
    submit: {
      type: 'plain_text',
      text: 'Reply',
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
      emoji: true,
    },
    title: {
      type: 'plain_text',
      text: 'theGist for mail',
      emoji: true,
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: 'To connect theGist to your gmail account please click on the button below',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Reply to:* ${address}`,
        },
      },
      {
        type: 'input',
        block_id: 'reply',
        element: {
          type: 'static_select',
          initial_option: repliesBlocks[0],
          placeholder: {
            type: 'plain_text',
            text: 'Select a reply',
            emoji: true,
          },
          options: repliesBlocks,
          action_id: 'static_select-action',
        },
        label: {
          type: 'plain_text',
          text: 'Reply content',
          emoji: true,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Save as Draft',
              emoji: true,
            },
            style: 'primary',
            value: 'save_draft',
            action_id: 'save_draft',
          },
        ],
      },
    ],
  };
};
