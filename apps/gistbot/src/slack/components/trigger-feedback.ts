import { KnownBlock } from '@slack/web-api';
import { Routes } from '../../routes/router';
export const extractTriggerFeedback = (value: string): [string, string] => {
  const split = value.split('|');
  if (split.length !== 2) {
    throw new Error('failed to split trigger feedback to 2 parts');
  }
  return [split[0], split[1]];
};
export const TriggersFeedBack = (context: string): KnownBlock[] => {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Do you find this message helpful?',
      },
      accessory: {
        type: 'static_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select an item',
          emoji: true,
        },
        options: [
          {
            text: {
              type: 'plain_text',
              text: ':+1: Yes thanks!',
              emoji: true,
            },
            value: `true|${context}`,
          },
          {
            text: {
              type: 'plain_text',
              text: ':thumbsdown: No! please stop them',
              emoji: true,
            },
            value: `false|${context}`,
          },
        ],
        action_id: Routes.TRIGGER_FEEDBACK,
      },
    },
  ];
};
