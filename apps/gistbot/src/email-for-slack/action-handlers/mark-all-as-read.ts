import { AnalyticsManager } from '@base/gistbot-shared';
import axios from 'axios';
import { SlackBlockActionWrapper } from '../../slack/types';
import { MAIL_BOT_SERVICE_API } from '../types';
import { updateButtonText } from './helpers';

const MARK_ALL_AS_READ_PATH = '/mail/bulk-actions/mark-as-read';
const FAIL_TEXT = 'Failed :(';
const SUCCESS_TEXT = 'Read ✅';

export const markAllAsReadHandler =
  (analyticsManager: AnalyticsManager) =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    await ack();
    const action = body.actions[0];
    if (action.type !== 'button') {
      throw new Error(
        `markAllAsReadHandler received non-button action for user ${body.user.id}`,
      );
    }

    let isError = false;
    const mailId = action.value;
    try {
      logger.debug(`mark all as read handler for user ${body.user.id}`);
      if (!body.team?.id) {
        logger.error(
          `team id not exist for user ${body.user.id} in markAllAsReadHandler`,
        );
        return;
      }

      await updateButtonText(body, action, logger, client, SUCCESS_TEXT);
      const url = new URL(MAIL_BOT_SERVICE_API);
      url.pathname = MARK_ALL_AS_READ_PATH;

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
        isError = true;
        logger.error(
          `email markAllAsReadHandler wasn't able to mark as read for user ${body.user.id} with response ${response.status}`,
        );
        await updateButtonText(body, action, logger, client, FAIL_TEXT);
      }
    } catch (e) {
      isError = true;
      await updateButtonText(body, action, logger, client, FAIL_TEXT);
      logger.error(
        `error in markAllAsReadHandler for user ${body.user.id}, ${e}`,
      );
      throw e;
    } finally {
      analyticsManager.gmailUserAction({
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: 'mark_all_as_read',
        extraParams: {
          isError,
          mailId,
        },
      });
    }
  };
