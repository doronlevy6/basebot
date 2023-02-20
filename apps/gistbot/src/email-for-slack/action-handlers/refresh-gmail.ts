import axios from 'axios';
import { SlackBlockActionWrapper } from '../../slack/types';
import { MAIL_BOT_SERVICE_API } from '../types';

const REFRESH_PATH = '/mail/gmail-client';

export const refreshGmail =
  () =>
  async ({ ack, logger, body }: SlackBlockActionWrapper) => {
    await ack();
    try {
      logger.debug(`refreshing gmail for ${body.user.id}`);
      if (!body.team?.id) {
        logger.error(
          `team id not exist for user ${body.user.id} in refreshGmail`,
        );
        return;
      }

      const url = new URL(MAIL_BOT_SERVICE_API);
      url.pathname = REFRESH_PATH;

      await axios.post(url.toString(), {
        slackUserId: body.user.id,
        slackTeamId: body.team.id,
      });
    } catch (e) {
      logger.error(`error in refreshGmail for user ${body.user.id}, ${e}`);
      throw e;
    }
  };
