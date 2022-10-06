import { KnownBlock } from '@slack/web-api';
import { MessageShortcutImage } from './message-shortcut-image';
import { UserLink } from './user-link';

export const Help = (myBotUserId: string): KnownBlock[] => {
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
          'Use the message shortcut to summarize a message or a thread (see image below)' +
          '\n\n' +
          `You can also always simply ask us to summarize a channel or a thread by mentioning us like this: ${UserLink(
            myBotUserId,
          )} `,
      },
    },
    MessageShortcutImage(),
  ];
};
