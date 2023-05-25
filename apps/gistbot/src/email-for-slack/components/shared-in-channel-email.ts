import { KnownBlock } from '@slack/web-api';
import { DigestMessage } from '../types';
import { UserLink } from '../../slack/components/user-link';
import { createTimeString } from './email-digest-blocks';
import { splitTextBlocks } from '../../slack/utils';

export const SharedEmail = (
  messageToShare: DigestMessage,
  slackUserId: string,
  channelId: string,
  text?: string,
): KnownBlock[] => {
  const modifiedTitle = stripGmailLink(messageToShare.title);
  const blocksText = splitTextBlocks(messageToShare.body);
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${UserLink(slackUserId)} shared this with <#${channelId}> ${
          text ? `with the message:\n${text}` : ''
        }`,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${modifiedTitle}* _${
          messageToShare.timeStamp
            ? createTimeString(messageToShare.timeStamp)
            : ''
        }_\n`,
      },
    },
    ...blocksText.map((fs): KnownBlock => {
      return {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: fs,
        },
      };
    }),
  ];
};

function stripGmailLink(inputString) {
  const regex = /<([^|]*)\|/i;
  const match = regex.exec(inputString);

  if (match && match.length > 1 && match[1].includes('mail.google.com')) {
    const modifiedString = inputString.replace(regex, '');
    return modifiedString.replace('>', '');
  }

  return inputString;
}
