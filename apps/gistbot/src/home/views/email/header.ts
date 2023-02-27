import { KnownBlock } from '@slack/web-api';
import { pluralString } from '../../../utils/string';
import { Routes } from '../../../routes/router';
import { SlackDate } from '../../../slack/components/date';
import { IEmailRefreshMetadata } from '../../types';

export const EmailHeaderBlocks = (
  email: string,
  lastUpdated: number,
  refreshMetadata: IEmailRefreshMetadata,
): KnownBlock[] => {
  const { refreshing, error, numEmails } = refreshMetadata ?? {};
  let buttonText = 'Refresh';
  if (numEmails && numEmails > 0) {
    buttonText = `Fetching ${pluralString(numEmails, 'email')}...`;
  } else if (refreshing) {
    buttonText = 'Refreshing...';
  } else if (error) {
    buttonText = 'Failed refreshing';
  }

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: email,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Updated ' + SlackDate(lastUpdated / 1000 + ''),
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: buttonText,
            emoji: true,
          },
          action_id: Routes.REFRESH_GMAIL,
        },
      ],
    },
  ];
};
