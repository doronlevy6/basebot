import { AnalyticsManager } from '@base/gistbot-shared';
import axios from 'axios';
import {
  DISPLAY_ERROR_MODAL_EVENT_NAME,
  ON_MESSAGE_CLEARED_EVENT_NAME,
  OnMessageClearedEvent,
} from '../../home/types';
import { SlackBlockActionWrapper } from '../../slack/types';
import { MAIL_BOT_SERVICE_API } from '../types';
import { GmailSubscriptionsManager } from '../gmail-subscription-manager/gmail-subscription-manager';
import { IMailErrorMetaData } from '../views/email-error-view';
import EventEmitter = require('events');

const ARCHIVE_PATH = '/mail/gmail-client/archive';

export const archiveHandler =
  (
    analyticsManager: AnalyticsManager,
    eventEmitter: EventEmitter,
    gmailSubscriptionsManager: GmailSubscriptionsManager,
  ) =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    await ack();
    try {
      const action = body.actions[0];
      if (action.type !== 'button') {
        throw new Error(
          `email archiveHandler received non-button action for user ${body.user.id}`,
        );
      }
      const mailId = action.value;

      analyticsManager.gmailUserAction({
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: 'archive',
        extraParams: {
          mailId,
        },
      });

      if (!body.user.id || !body.team?.id) {
        throw new Error(`email archive handler received no user id or team id`);
      }
      const allowedAction = await gmailSubscriptionsManager.showPaywallIfNeeded(
        body.user.id,
        body.team?.id,
        'archive',
        { logger, body, client },
      );
      if (!allowedAction) {
        return;
      }

      if (!body.team?.id) {
        logger.error(
          `team id not exist for user ${body.user.id} in archiveHandler`,
        );
        return;
      }

      // We assume the archive worked in order to be faster ux in 99% of the cases
      eventEmitter.emit(ON_MESSAGE_CLEARED_EVENT_NAME, {
        id: mailId,
        slackUserId: body.user.id,
        slackTeamId: body.team.id,
      } as OnMessageClearedEvent);

      const url = new URL(MAIL_BOT_SERVICE_API);
      url.pathname = ARCHIVE_PATH;
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
        throw new Error(
          `email archiveHandler wasn't able to mark as read for user ${body.user.id} with response ${response.status}`,
        );
      }
    } catch (e) {
      logger.error(`error in archiveHandler for user ${body.user.id}`, e);
      eventEmitter.emit(DISPLAY_ERROR_MODAL_EVENT_NAME, {
        triggerId: body.trigger_id,
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: 'archive',
      } as IMailErrorMetaData);
      throw e;
    }
  };
