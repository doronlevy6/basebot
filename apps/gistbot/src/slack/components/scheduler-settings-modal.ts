import { ModalView, Option } from '@slack/bolt';
import { Routes } from '../../routes/router';
import { UserSchedulerOptions } from '../../summary-scheduler/types';

const onOption: Option = {
  text: {
    type: 'plain_text',
    text: 'On',
  },
  value: UserSchedulerOptions.ON,
};

const offOption: Option = {
  text: {
    type: 'plain_text',
    text: 'Off',
  },
  value: UserSchedulerOptions.OFF,
};

const morningOption: Option = {
  text: {
    type: 'plain_text',
    text: `9:00 AM, I want yesterday's recap.`,
  },
  value: UserSchedulerOptions.MORNING,
};

const eveningOption: Option = {
  text: {
    type: 'plain_text',
    text: `5:00 PM, I want today's discussions.`,
  },
  value: UserSchedulerOptions.EVENING,
};

export const SchedulerSettingsModal = (
  enabled?: UserSchedulerOptions.ON | UserSchedulerOptions.OFF,
  hour?: UserSchedulerOptions.MORNING | UserSchedulerOptions.EVENING,
  channels?: string[],
): ModalView => {
  return {
    type: 'modal',
    callback_id: Routes.SCHEDULER_SETTINGS_MODAL_SUBMIT,
    title: {
      type: 'plain_text',
      text: 'Digest Settings',
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
        type: 'section',
        block_id: 'multi_conversations_select',
        text: {
          type: 'mrkdwn',
          text: 'Add/Remove channels from the summary:',
        },
        accessory: {
          type: 'multi_conversations_select',
          placeholder: {
            type: 'plain_text',
            text: 'Select conversations',
            emoji: true,
          },
          filter: {
            include: ['public'],
            exclude_bot_users: true,
            exclude_external_shared_channels: true,
          },
          initial_conversations: channels,
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
        type: 'input',
        block_id: 'radio-buttons-time',
        label: {
          type: 'plain_text',
          text: 'When would you like to receive the summary?',
          emoji: true,
        },
        element: {
          type: 'radio_buttons',
          options: [morningOption, eveningOption],
          initial_option:
            hour === UserSchedulerOptions.EVENING
              ? eveningOption
              : morningOption,
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
        type: 'input',
        block_id: 'radio-buttons-switch',
        label: {
          type: 'plain_text',
          text: 'Get daily summaries',
          emoji: true,
        },
        element: {
          type: 'radio_buttons',
          options: [onOption, offOption],
          initial_option:
            enabled === UserSchedulerOptions.OFF ? offOption : onOption,
          action_id: 'value',
        },
      },
    ],
  };
};
