import { ModalView } from '@slack/web-api';
import { Routes } from '../../routes/router';

export const AllSettingsModal = (): ModalView => {
  return {
    type: 'modal',
    callback_id: Routes.REFRESH_GMAIL_FROM_VIEW,
    title: {
      type: 'plain_text',
      text: 'theGist Settings',
      emoji: true,
    },
    submit: {
      type: 'plain_text',
      text: 'Done',
    },
    close: {
      type: 'plain_text',
      text: 'Close',
      emoji: true,
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Gmail Digest',
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Configure',
            emoji: true,
          },
          value: 'gmail-settings',
          action_id: Routes.OPEN_EMAIL_SETTINGS_MODAL_FROM_ALL,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Slack Digest',
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Configure',
            emoji: true,
          },
          value: 'slack-gist-settings',
          action_id: Routes.OPEN_SLACK_SETTINGS_MODAL_FROM_ALL,
        },
      },
    ],
  };
};
