import { ModalView } from '@slack/web-api';
interface IProps {
  metadata?: string;
  submitCallback: string;
  userInput?: string;
  address?: string;
}

export const REPLY_BLOCK_ID = 'reply';
export const REPLY_ELEMENT_ACTION_ID = 'reply-action-id';
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
          type: 'mrkdwn',
          text: `*Reply to:* ${address}`,
        },
      },
      {
        type: 'input',
        block_id: REPLY_BLOCK_ID,
        element: {
          type: 'plain_text_input',
          multiline: true,
          min_length: 1,
          placeholder: {
            type: 'plain_text',
            text: 'Select a reply',
            emoji: true,
          },

          action_id: REPLY_ELEMENT_ACTION_ID,
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
