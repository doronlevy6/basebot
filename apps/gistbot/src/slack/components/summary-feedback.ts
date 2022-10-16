import { StaticSelect } from '@slack/bolt';

export const extractSessionIdAndValueFromFeedback = (
  value: string,
): [string, string] => {
  const split = value.split(':');
  if (split.length !== 2) {
    throw new Error('failed to split session id to 2 parts');
  }
  return [split[0], split[1]];
};

export const SummaryFeedback = (
  actionId: string,
  sessionId: string,
): StaticSelect => {
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
          text: ':+1: Great summary',
          emoji: true,
        },
        value: `${sessionId}:good`,
      },
      {
        text: {
          type: 'plain_text',
          text: ':-1: Summary needs improvement',
          emoji: true,
        },
        value: `${sessionId}:not_good`,
      },
      {
        text: {
          type: 'plain_text',
          text: ':exclamation: Summary was inappropriate',
          emoji: true,
        },
        value: `${sessionId}:inappropriate`,
      },
    ],
    action_id: actionId,
  };
};
