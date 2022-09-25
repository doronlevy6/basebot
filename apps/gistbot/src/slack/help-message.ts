import { RespondFn } from '@slack/bolt';

export const respondWithHelp = async (respond: RespondFn) => {
  await respond({
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Hi there :wave: here are some ideas of what you can do:`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Use `/gist` from any channel to get a fresh summary of what happened in that channel.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Use `/gist #channel1 #channel2` to get a summary of what happened in those channels.',
        },
      },
    ],
  });
};
