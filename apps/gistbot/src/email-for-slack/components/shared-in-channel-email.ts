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
        text: `*${messageToShare.title}* _${
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
