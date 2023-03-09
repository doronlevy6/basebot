import { ModalView, Option, PlainTextOption } from '@slack/bolt';
import { EmailWorkMode } from './types';
import { Routes } from '../../routes/router';

const MarkAsRead: Option = {
  text: {
    type: 'plain_text',
    text: "Mark as read:\n\nThis mode shows only unread emails and removes an email from your inbox after you've marked it as read.",
    emoji: true,
  },
  value: EmailWorkMode.MarkAsRead,
};

const ArchiveOption: Option = {
  text: {
    type: 'plain_text',
    text: "Archive:\n\nThis mode shows all your emails and removes an email from your inbox after you've archived it.",
    emoji: true,
  },
  value: EmailWorkMode.Archive,
};

const TimeFrameOptions: PlainTextOption[] = [
  {
    text: {
      type: 'plain_text',
      text: '1 day',
      emoji: true,
    },
    value: '1',
  },
  {
    text: {
      type: 'plain_text',
      text: '2 days',
      emoji: true,
    },
    value: '2',
  },
  {
    text: {
      type: 'plain_text',
      text: '3 days',
      emoji: true,
    },
    value: '3',
  },
  {
    text: {
      type: 'plain_text',
      text: '4 days',
      emoji: true,
    },
    value: '4',
  },
  {
    text: {
      type: 'plain_text',
      text: '5 days',
      emoji: true,
    },
    value: '5',
  },
  {
    text: {
      type: 'plain_text',
      text: '6 days',
      emoji: true,
    },
    value: '6',
  },
  {
    text: {
      type: 'plain_text',
      text: '7 days',
      emoji: true,
    },
    value: '7',
  },
];

export const EmailSettingsModal = (
  email: string,
  workMode?: EmailWorkMode,
  timeFrame?: number,
): ModalView => {
  const timeFrameIndex = timeFrame ? timeFrame - 1 : 0;
  return {
    type: 'modal',
    callback_id: Routes.EMAIL_SETTINGS_MODAL_SUBMIT,
    private_metadata: email,
    title: {
      type: 'plain_text',
      text: 'Gmail summary Settings',
      emoji: true,
    },
    submit: {
      type: 'plain_text',
      text: 'Done',
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
      emoji: true,
    },
    blocks: [
      {
        type: 'divider',
      },
      {
        block_id: 'work-mode-select',
        type: 'input',
        element: {
          type: 'radio_buttons',
          focus_on_load: true,
          initial_option:
            workMode === EmailWorkMode.MarkAsRead ? MarkAsRead : ArchiveOption,
          options: [ArchiveOption, MarkAsRead],
          action_id: 'radio_buttons-action',
        },
        label: {
          type: 'plain_text',
          text: 'Email Working Mode',
          emoji: true,
        },
      },
      {
        type: 'section',
        block_id: 'timeframe-select',
        text: {
          type: 'mrkdwn',
          text: '*Email Retrieval Timeframe*',
        },
        accessory: {
          type: 'static_select',
          placeholder: {
            type: 'plain_text',
            text: 'Select an item',
            emoji: true,
          },
          initial_option: TimeFrameOptions[timeFrameIndex],
          options: TimeFrameOptions,
          action_id: 'static_select-action',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'plain_text',
            text: 'For example, selecting 3 days will display emails from the last 72 hours.',
            emoji: true,
          },
        ],
      },
      {
        type: 'divider',
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
