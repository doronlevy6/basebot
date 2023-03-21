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
const fullWeekdays = [0, 1, 2, 3, 4, 5, 6];
const weekdays = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const SchedulerSettingsModal = (
  enabled?: UserSchedulerOptions.ON | UserSchedulerOptions.OFF,
  hour?: UserSchedulerOptions.MORNING | UserSchedulerOptions.EVENING,
  channels?: string[],
  defaultDays?: number[],
): ModalView => {
  const defaultWorkDays = defaultDays || fullWeekdays;

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
        type: 'input',
        optional: false,
        block_id: 'multi_conversations_select',
        label: {
          type: 'plain_text',
          text: 'Add/Remove channels from the summary:',
        },
        element: {
          type: 'multi_conversations_select',
          placeholder: {
            type: 'plain_text',
            text: 'Select conversations',
            emoji: true,
          },
          filter: {
            include: ['public', 'private'],
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
        block_id: 'checkbox-day-of-week',
        element: {
          type: 'checkboxes',
          action_id: 'day_of_week',
          initial_options: formatDaysOfWeek(defaultWorkDays),
          options: formatDaysOfWeek(fullWeekdays),
        },
        label: {
          type: 'plain_text',
          text: 'Select a day of the week:',
          emoji: true,
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
export function formatDaysOfWeek(daysOfWeek: number[]): Option[] {
  return daysOfWeek.map((day) => {
    return {
      text: {
        type: 'plain_text',
        text: weekdays[day],
      },
      value: day.toString(),
    };
  });
}
