import { ModalView } from '@slack/web-api';
import { Routes } from '../../routes/router';
import { KnownBlock } from '@slack/web-api';

export const AllSettingsModal = (userEmailEnabled: boolean): ModalView => {
  const buttonBlocks: KnownBlock[] = theGistSettingsButton();
  if (userEmailEnabled) {
    buttonBlocks.push(...gmailSettingsButton());
  }

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
    blocks: buttonBlocks,
  };
};
export const theGistSettingsButton = (): KnownBlock[] => {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Slack Digest configuration',
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
  ];
};

export const gmailSettingsButton = (): KnownBlock[] => {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Gmail configuration',
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
  ];
};
