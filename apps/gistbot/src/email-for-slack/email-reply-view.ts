import { ModalView } from '@slack/web-api';
interface IProps {
  metadata?: string;
  submitCallback: string;
  userInput?: string;
  address?: string;
}

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
          type: 'plain_text_input',
          multiline: true,
          min_length: 1,
          placeholder: {
            type: 'plain_text',
            text: 'Select a reply',
            emoji: true,
          },

          action_id: 'reply-text',
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
