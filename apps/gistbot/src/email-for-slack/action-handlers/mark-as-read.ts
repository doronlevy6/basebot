import { AnalyticsManager } from '@base/gistbot-shared';
import axios from 'axios';
import { EventEmitter } from 'events';
import {
  OnMessageClearedEvent,
  ON_MESSAGE_CLEARED_EVENT_NAME,
} from '../../home/types';
import { SlackBlockActionWrapper } from '../../slack/types';
import { MAIL_BOT_SERVICE_API } from '../types';
import { GmailSubscriptionsManager } from '../gmail-subscription-manager/gmail-subscription-manager';

const MARK_AS_READ_PATH = '/mail/gmail-client/markAsRead';

export const markAsReadHandler =
  (
    analyticsManager: AnalyticsManager,
    eventsEmitter: EventEmitter,
    gmailSubscriptionsManager: GmailSubscriptionsManager,
  ) =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    await ack();
    const action = body.actions[0];
    if (action.type !== 'button') {
      throw new Error(
        `email markAsReadHandler received non-button action for user ${body.user.id}`,
      );
    }
    if (!body.user.id || !body.team?.id) {
      throw new Error(
        `email mark as read handler received no user id or team id`,
      );
    }
    const allowedAction = await gmailSubscriptionsManager.showPaywallIfNeeded(
      body.user.id,
      body.team?.id,
      'mark_as_read',
      { logger, body, client },
    );
    if (!allowedAction) {
      return;
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

      // We assume the archive worked in order to be faster ux in 99% of the cases
      eventsEmitter.emit(ON_MESSAGE_CLEARED_EVENT_NAME, {
        id: mailId,
        slackUserId: body.user.id,
        slackTeamId: body.team.id,
      } as OnMessageClearedEvent);

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
        // TODO: Show error modal and call refresh as we deleted the message and may be out of sync.
        return;
      }
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
