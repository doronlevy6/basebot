import { logger } from '@base/logger';
import { KnownBlock } from '@slack/web-api';
import { Routes } from '../../../routes/router';
import { STRIPE_URL } from '../../../slack/components/go-pro-button';

const APP_ID = process.env.SLACK_APP_ID;
const deepLink = (teamId: string) =>
  `slack://app?team=${teamId}&id=${APP_ID}&tab=about`;

export const EmailFooterBlocks = (
  teamId: string,
  timeLeft?: number,
): KnownBlock[] => {
  if (timeLeft === undefined) {
    logger.info(`Footer blocks called without timeLeft`);
    return [];
  }
  let text = `Your free trial expires in ${timeLeft} days. *<${STRIPE_URL}|Upgrade to Pro>* and get an *extra month* free! 🚀`;
  if (timeLeft < 0) {
    text = `We hope you enjoyed your 30 days of free Pro features! *<${STRIPE_URL}|Go pro with a free month trial!>* 🚀`;
  }

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: text,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `For help and additional information see the <${deepLink(
            teamId,
          )}|About> tab. We would love to hear from you at support@thegist.ai!`,
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Email Digest settings',
            emoji: true,
          },
          action_id: Routes.EMAIL_SETTINGS_OPEN_MODAL,
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Request a feature',
            emoji: true,
          },
          action_id: Routes.SEND_USER_FEEDBACK,
        },
      ],
    },
  ];
};
