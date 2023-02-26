import { AnalyticsManager } from '@base/gistbot-shared';
import axios from 'axios';
import EventEmitter = require('events');
import {
  OnMessageClearedEvent,
  ON_MESSAGE_CLEARED_EVENT_NAME,
} from '../../home/types';
import { SlackBlockActionWrapper } from '../../slack/types';
import { MAIL_BOT_SERVICE_API } from '../types';
import { GmailSubscriptionsManager } from '../gmail-subscription-manager/gmail-subscription-manager';

const ARCHIVE_PATH = '/mail/gmail-client/archive';

export const archiveHandler =
  (
    analyticsManager: AnalyticsManager,
    eventEmitter: EventEmitter,
    gmailSubscriptionsManager: GmailSubscriptionsManager,
  ) =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    await ack();
    const action = body.actions[0];
    if (action.type !== 'button') {
      throw new Error(
        `email archiveHandler received non-button action for user ${body.user.id}`,
      );
    }
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
    let isError = false;
    const mailId = action.value;
    try {
      if (!body.team?.id) {
        logger.error(
          `team id not exist for user ${body.user.id} in archiveHandler`,
        );
        return;
      }

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
        isError = true;
        logger.error(
          `email archiveHandler wasn't able to mark as read for user ${body.user.id} with response ${response.status}`,
        );
        // TODO: Show error modal
        return;
      }

      eventEmitter.emit(ON_MESSAGE_CLEARED_EVENT_NAME, {
        id: mailId,
        slackUserId: body.user.id,
        slackTeamId: body.team.id,
      } as OnMessageClearedEvent);
    } catch (e) {
      isError = true;
      logger.error(`error in archiveHandler for user ${body.user.id}, ${e}`);
      // TODO: Show error modal
      throw e;
    } finally {
      analyticsManager.gmailUserAction({
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: 'archive',
        extraParams: {
          mailId,
          isError,
        },
      });
    }
  };
