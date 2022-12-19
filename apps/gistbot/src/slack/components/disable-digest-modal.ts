import { ModalView, Option } from '@slack/bolt';
import { Routes } from '../../routes/router';

export const SchedulerSettingsDisableModal = (): ModalView => {
  return {
    type: 'modal',
    callback_id: Routes.SCHEDULER_SETTINGS_DISABLE,
    title: {
      type: 'plain_text',
      text: 'Turn Off Digest',
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
        text: {
          type: 'mrkdwn',
          text: `Are you sure you want to turn off the digest? \n\n You will be able to turn on the digest and customize it by tapping the ‘Daily Digest Settings’ button`,
        },
      },
    ],
  };
};
