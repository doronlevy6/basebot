import { ModalView, Option } from '@slack/bolt';
import { EmailSchedulerOptions } from './types';
import { Routes } from '../../routes/router';

const onOption: Option = {
  text: {
    type: 'plain_text',
    text: 'On',
  },
  value: EmailSchedulerOptions.ON,
};

const offOption: Option = {
  text: {
    type: 'plain_text',
    text: 'Off',
  },
  value: EmailSchedulerOptions.OFF,
};

export const EmailSettingsModal = (
  enabled?: EmailSchedulerOptions.ON | EmailSchedulerOptions.OFF,
): ModalView => {
  return {
    type: 'modal',
    callback_id: Routes.EMAIL_SETTINGS_MODAL_SUBMIT,
    title: {
      type: 'plain_text',
      text: 'Gmail summary Settings',
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
        block_id: 'radio-buttons-switch',
        label: {
          type: 'plain_text',
          text: 'Get gmail summaries',
          emoji: true,
        },
        element: {
          type: 'radio_buttons',
          options: [onOption, offOption],
          initial_option:
            enabled === EmailSchedulerOptions.OFF ? offOption : onOption,
          action_id: 'value',
        },
      },
      {
        type: 'section',
        text: {
          text: '\n\n',
          type: 'mrkdwn',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Email links takes you to a different Gmail account?',
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Tap here to fix it',
            emoji: true,
          },
          value: 'broken-link',
          action_id: Routes.EMAIL_LINK_BROKEN_OPEN_MODAL,
        },
      },
    ],
  };
};
