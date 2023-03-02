import { ModalView } from '@slack/web-api';

export interface IMailErrorMetaData {
  triggerId: string;
  slackTeamId: string;
  slackUserId: string;
  action: string;
}

export const MailErrorView: (callback_id: string) => ModalView = (
  callback_id: string,
) => {
  return {
    type: 'modal',
    callback_id: callback_id,
    title: {
      type: 'plain_text',
      text: 'My App',
      emoji: true,
    },
    submit: {
      type: 'plain_text',
      text: 'Refresh Inbox',
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
      emoji: true,
    },
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Something is not working',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Oh No!! Something went wrong :scream_cat:\nYou can try to refresh your mail and try again in few minutes ',
        },
      },
    ],
  };
};
