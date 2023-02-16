import { ModalView } from '@slack/bolt';
import { Routes } from '../../routes/router';

interface IProps {
  urlBlockId: string;
  urlBlockActionId: string;
}

export const EmailSettingsBrokenLinkModal = ({
  urlBlockActionId,
  urlBlockId,
}: IProps): ModalView => {
  return {
    type: 'modal',
    callback_id: Routes.EMAIL_LINK_BROKEN_MODAL_SUBMIT,
    title: {
      type: 'plain_text',
      text: "Links aren't working?",
      emoji: true,
    },
    submit: {
      type: 'plain_text',
      text: 'Submit',
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
      emoji: true,
    },
    blocks: [
      {
        type: 'input',
        block_id: urlBlockId,
        element: {
          type: 'url_text_input' as unknown as never, // TODO: Update bolt.js for new types?
          action_id: urlBlockActionId,
        },
        label: {
          type: 'plain_text',
          text: 'Paste the URL of the right Gmail account',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "Make sure it's the right Gmail account.\nOnce you paste it we will link the right account to the Email links",
        },
      },
    ],
  };
};
