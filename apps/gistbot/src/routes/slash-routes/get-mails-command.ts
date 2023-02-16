import { logger } from '@base/logger';
import axios from 'axios';
import { responder } from '../../slack/responder';
import { SlackSlashCommandWrapper } from '../../slack/types';

const BASE_URL = process.env.MAIL_BOT_SERVICE_API || '';

export const getMailsCommand = async ({
  client,
  respond,
  body: { user_id, channel_id, team_id },
  ack,
}: SlackSlashCommandWrapper) => {
  await ack();
  await responder(
    respond,
    client,
    'Fetching your emails',
    [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Fetching your emails...' },
      },
    ],
    channel_id,
    user_id,
    { response_type: 'ephemeral' },
  );

  const url = new URL(BASE_URL);
  url.pathname = '/mail/gmail-client';
  try {
    await axios.post(
      url.toString(),
      {
        slackUserId: user_id,
        slackTeamId: team_id,
      },
      {
        timeout: 60000,
      },
    );
    return;
  } catch (e) {
    logger.error(`get mails handler error:${url.toString()} ${e} ${e.stack}`);
    return;
  }
};
