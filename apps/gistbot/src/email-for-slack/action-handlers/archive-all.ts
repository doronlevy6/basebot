import axios from 'axios';
import { SlackBlockActionWrapper } from '../../slack/types';
import { MAIL_BOT_SERVICE_API } from '../types';
import { updateButtonText } from './helpers';

const ARCHIVE_ALL_PATH = '/mail/bulk-actions/archive';
const FAIL_TEXT = 'Failed :(';
const SUCCESS_TEXT = 'Archived ✅';

export const archiveAllHandler =
  () =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    await ack();
    const action = body.actions[0];
    if (action.type !== 'button') {
      throw new Error(
        `archiveAllHandler received non-button action for user ${body.user.id}`,
      );
    }

    try {
      logger.debug(`archive all handler for user ${body.user.id}`);
      if (!body.team?.id) {
        logger.error(
          `team id not exist for user ${body.user.id} in archiveAllHandler`,
        );
        return;
      }

      await updateButtonText(body, action, logger, client, SUCCESS_TEXT);
      const mailId = action.value;
      const url = new URL(MAIL_BOT_SERVICE_API);
      url.pathname = ARCHIVE_ALL_PATH;

      const response = await axios.post(
        url.toString(),
        {
          slackUserId: body.user.id,
          slackTeamId: body.team.id,
          groupId: mailId,
        },
        {
          timeout: 60000,
        },
      );
      if (response.status !== 200 && response.status !== 201) {
        logger.error(
          `email archiveAllHandler wasn't able to mark as read for user ${body.user.id} with response ${response.status}`,
        );
        await updateButtonText(body, action, logger, client, FAIL_TEXT);
      }
    } catch (e) {
      await updateButtonText(body, action, logger, client, FAIL_TEXT);
      logger.error(`error in archiveAllHandler for user ${body.user.id}, ${e}`);
      throw e;
    }
  };
