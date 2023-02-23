import { AnalyticsManager } from '@base/gistbot-shared';
import axios from 'axios';
import EventEmitter = require('events');
import {
  OnMessageClearedEvent,
  ON_MESSAGE_CLEARED_EVENT_NAME,
} from '../../home/types';
import { SlackBlockActionWrapper } from '../../slack/types';
import { MAIL_BOT_SERVICE_API } from '../types';
import { updateButtonText } from './helpers';

const ARCHIVE_ALL_PATH = '/mail/bulk-actions/archive';
const FAIL_TEXT = 'Failed :(';
const SUCCESS_TEXT = 'Archived ✅';

export const archiveAllHandler =
  (analyticsManager: AnalyticsManager, eventEmitter: EventEmitter) =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    await ack();
    const action = body.actions[0];
    if (action.type !== 'button') {
      throw new Error(
        `archiveAllHandler received non-button action for user ${body.user.id}`,
      );
    }

    let isError = false;
    const mailId = action.value;
    try {
      logger.debug(`archive all handler for user ${body.user.id}`);
      if (!body.team?.id) {
        logger.error(
          `team id not exist for user ${body.user.id} in archiveAllHandler`,
        );
        return;
      }

      await updateButtonText(body, action, logger, client, SUCCESS_TEXT);
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
        isError = true;
        logger.error(
          `email archiveAllHandler wasn't able to mark as read for user ${body.user.id} with response ${response.status}`,
        );
        await updateButtonText(body, action, logger, client, FAIL_TEXT);
        return;
      }

      eventEmitter.emit(ON_MESSAGE_CLEARED_EVENT_NAME, {
        id: mailId,
        slackUserId: body.user.id,
        slackTeamId: body.team.id,
      } as OnMessageClearedEvent);
    } catch (e) {
      isError = true;
      await updateButtonText(body, action, logger, client, FAIL_TEXT);
      logger.error(`error in archiveAllHandler for user ${body.user.id}, ${e}`);
      throw e;
    } finally {
      analyticsManager.gmailUserAction({
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: 'archive_all',
        extraParams: {
          groupId: mailId,
          isError,
        },
      });
    }
  };
