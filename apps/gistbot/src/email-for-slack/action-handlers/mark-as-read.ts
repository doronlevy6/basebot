import { AnalyticsManager } from '@base/gistbot-shared';
import axios from 'axios';
import EventEmitter = require('events');
import {
  OnMessageClearedEvent,
  ON_MESSAGE_CLEARED_EVENT_NAME,
} from '../../home/types';
import { SlackBlockActionWrapper } from '../../slack/types';
import { MAIL_BOT_SERVICE_API } from '../types';

const MARK_AS_READ_PATH = '/mail/gmail-client/markAsRead';

export const markAsReadHandler =
  (analyticsManager: AnalyticsManager, eventsEmitter: EventEmitter) =>
  async ({ ack, logger, body }: SlackBlockActionWrapper) => {
    await ack();
    const action = body.actions[0];
    if (action.type !== 'button') {
      throw new Error(
        `email markAsReadHandler received non-button action for user ${body.user.id}`,
      );
    }

    let isError = false;
    const mailId = action.value;
    try {
      logger.debug(`mark as read handler for user ${body.user.id}`);
      if (!body.team?.id) {
        logger.error(
          `team id not exist for user ${body.user.id} in markAsReadHandler`,
        );
        return;
      }

      const url = new URL(MAIL_BOT_SERVICE_API);
      url.pathname = MARK_AS_READ_PATH;

      const response = await axios.post(
        url.toString(),
        {
          slackUserId: body.user.id,
          slackTeamId: body.team.id,
          id: mailId,
        },
        {
          timeout: 60000,
        },
      );

      if (response.status !== 200 && response.status !== 201) {
        logger.error(
          `email markAsReadHandler wasn't able to mark as read for user ${body.user.id} with response ${response.status}`,
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
      // TODO: Show error modal
      logger.error(`error in markAsReadHandler for user ${body.user.id}, ${e}`);
      throw e;
    } finally {
      analyticsManager.gmailUserAction({
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: 'mark_as_read',
        extraParams: {
          isError,
          mailId,
        },
      });
    }
  };
