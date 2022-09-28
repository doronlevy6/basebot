import { StaticSelect } from '@slack/bolt';

export const SummaryFeedback = (actionId: string): StaticSelect => {
  return {
    type: 'static_select',
    placeholder: {
      type: 'plain_text',
      text: 'Feedback',
      emoji: true,
    },
    options: [
      {
        text: {
          type: 'plain_text',
          text: 'Amazing summary, great job!',
          emoji: true,
        },
        value: 'amazing',
      },
      {
        text: {
          type: 'plain_text',
          text: 'Summary was OK',
          emoji: true,
        },
        value: 'ok',
      },
      {
        text: {
          type: 'plain_text',
          text: "Summary wasn't relevant",
          emoji: true,
        },
        value: 'not_relevant',
      },
      {
        text: {
          type: 'plain_text',
          text: 'Summary was incorrect',
          emoji: true,
        },
        value: 'incorrect',
      },
      {
        text: {
          type: 'plain_text',
          text: 'Summary was inappropriate',
          emoji: true,
        },
        value: 'inappropriate',
      },
    ],
    action_id: actionId,
  };
};
