import { Block, View } from '@slack/web-api';
import { Routes } from '../../routes/router';
import { createGmailAuthUrl } from '../../slack/components/connect-to-gmail';
import { IHomeViewMetadata } from '../types';
import { SlackDate } from '../../slack/components/date';

const HEADER_BLOCKS_PREFIX = 'home-';

export const EmailHomeView = (
  contentBlocks: Block[],
  privateMetadata: IHomeViewMetadata,
): View => {
  const { teamId, updatedAt, userId } = privateMetadata;
  const updatedAtText = updatedAt
    ? `Last inbox sync: ${SlackDate(updatedAt / 1000 + '')}`
    : '';
  return {
    type: 'home',
    private_metadata: JSON.stringify(privateMetadata),
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `theGist for Gmail`,
        },
        block_id: HEADER_BLOCKS_PREFIX + 'header-title',
      },
      {
        type: 'section',
        block_id: HEADER_BLOCKS_PREFIX + 'header-body',
        text: {
          type: 'mrkdwn',
          text:
            'Your hometab is the place to see all your emails from Gmail. Click on the button below to connect your Gmail account and srart managing your inbox!\n' +
            updatedAtText,
        },
      },
      {
        type: 'actions',
        block_id: HEADER_BLOCKS_PREFIX + 'nav-buttons',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Refresh',
              emoji: true,
            },
            action_id: Routes.REFRESH_GMAIL,
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Connect Gmail',
              emoji: true,
            },
            url: createGmailAuthUrl(userId, teamId),
          },
        ],
      },
      {
        type: 'divider',
        block_id: HEADER_BLOCKS_PREFIX + 'divider',
      },
      ...contentBlocks.filter(
        (block) => !block.block_id?.startsWith(HEADER_BLOCKS_PREFIX),
      ),
    ],
  };
};
