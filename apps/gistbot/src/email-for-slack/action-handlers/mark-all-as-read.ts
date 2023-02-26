import { AnalyticsManager } from '@base/gistbot-shared';
import axios from 'axios';
import EventEmitter = require('events');
import {
  OnMessageClearedEvent,
  ON_MESSAGE_CLEARED_EVENT_NAME,
} from '../../home/types';
import { SlackBlockActionWrapper } from '../../slack/types';
import { MAIL_BOT_SERVICE_API } from '../types';

const MARK_ALL_AS_READ_PATH = '/mail/bulk-actions/mark-as-read';

export const markAllAsReadHandler =
  (analyticsManager: AnalyticsManager, eventsEmitter: EventEmitter) =>
  async ({ ack, logger, body }: SlackBlockActionWrapper) => {
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
        // TODO: Show error modal
        return;
      }

      eventsEmitter.emit(ON_MESSAGE_CLEARED_EVENT_NAME, {
        id: mailId,
        slackUserId: body.user.id,
        slackTeamId: body.team.id,
      } as OnMessageClearedEvent);
    } catch (e) {
      isError = true;
      logger.error(
        `error in markAllAsReadHandler for user ${body.user.id}, ${e}`,
      );
      // TODO: Show error modal
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
