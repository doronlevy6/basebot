import { RespondFn } from '@slack/bolt';

const IMAGE_URL = 'https://assets.base.la/gist/assets/welcomeMessage.jpg';

export const respondWithHelp = async (respond: RespondFn) => {
  await respond({
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            'Hi there :wave:' +
            '\n' +
            'here are some ideas of what you can do:' +
            '\n' +
            '*Summarize channels:*' +
            '\n\n' +
            `Use \`/gist\` from any channel to get a fresh summary of what happened in that channel.` +
            '\n' +
            `Use \`/gist #channel1 #channel2\` to get a summary of what happened in those channels.` +
            '\n\n' +
            '*Summarize threads:*' +
            '\n\n' +
            'Use the message shortcut to summarize a message or a thread (see image below)',
        },
      },
      {
        type: 'image',
        title: {
          type: 'plain_text',
          text: 'image1',
          emoji: true,
        },
        image_url: IMAGE_URL,
        alt_text: 'image1',
      },
    ],
  });
};
