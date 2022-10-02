import { KnownBlock } from '@slack/web-api';
import { MessageShortcutImage } from './message-shortcut-image';

export const Help = (): KnownBlock[] => {
  return [
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
          '\n\n' +
          '*Summarize threads:*' +
          '\n\n' +
          'Use the message shortcut to summarize a message or a thread (see image below)',
      },
    },
    MessageShortcutImage(),
  ];
};
