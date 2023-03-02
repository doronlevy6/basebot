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
import { SectionActionProps } from './section-actions';
import EventEmitter = require('events');

const ARCHIVE_ALL_PATH = '/mail/bulk-actions/archive';

export const archiveAllHandler =
  (
    analyticsManager: AnalyticsManager,
    eventEmitter: EventEmitter,
    gmailSubscriptionsManager: GmailSubscriptionsManager,
  ) =>
  async ({ ack, body, logger, client }: SlackBlockActionWrapper) => {
    await ack();
    try {
      const action = body.actions[0];
      if (action.type !== 'button') {
        throw new Error(
          `archiveAllHandler received non-button action for user ${body.user.id}`,
        );
      }
      if (!body.user.id || !body.team?.id) {
        throw new Error(
          `email archive all handler received no user id or team id`,
        );
      }
      const mailId = action.value;
      const allowedAction = await gmailSubscriptionsManager.showPaywallIfNeeded(
        body.user.id,
        body.team?.id,
        'archive_all',
        { logger: logger, body: body, client: client },
      );
      if (!allowedAction) {
        return;
      }
      await archiveAll({ logger, body }, eventEmitter, mailId);
      analyticsManager.gmailUserAction({
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: 'archive_all',
        extraParams: {
          groupId: mailId,
        },
      });
    } catch (e) {
      logger.error(`error in archiveAllHandler for user ${body.user.id}`, e);
      eventEmitter.emit(DISPLAY_ERROR_MODAL_EVENT_NAME, {
        triggerId: body.trigger_id,
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: 'archive_all',
      } as IMailErrorMetaData);
      throw e;
    }
  };

export const archiveAll = async (
  { logger, body }: SectionActionProps,
  eventEmitter: EventEmitter,
  mailId: string,
) => {
  logger.debug(`archive all handler for user ${body.user.id}`);
  if (!body.team?.id) {
    throw new Error(
      `team id not exist for user ${body.user.id} in archiveAllHandler`,
    );
  }
  // We assume the archive worked in order to be faster ux in 99% of the cases
  eventEmitter.emit(ON_MESSAGE_CLEARED_EVENT_NAME, {
    id: mailId,
    slackUserId: body.user.id,
    slackTeamId: body.team.id,
  } as OnMessageClearedEvent);

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
    throw new Error(
      `email archiveAllHandler wasn't able to mark as read for user ${body.user.id} with response ${response.status}`,
    );
  }
};
