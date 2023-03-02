import { AnalyticsManager } from '@base/gistbot-shared';
import { ButtonAction } from '@slack/bolt';
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
import { SectionActionProps } from './section-actions';

const MARK_ALL_AS_READ_PATH = '/mail/bulk-actions/mark-as-read';

export const markAllAsReadHandler =
  (
    analyticsManager: AnalyticsManager,
    eventsEmitter: EventEmitter,
    gmailSubscriptionsManager: GmailSubscriptionsManager,
  ) =>
  async ({ logger, body, ack, client }: SlackBlockActionWrapper) => {
    await ack();
    try {
      const action = body.actions[0] as ButtonAction;
      const mailId = action.value;
      if (action.type !== 'button') {
        throw new Error(
          `markAllAsReadHandler received non-button action for user ${body.user.id}`,
        );
      }
      if (!body.user.id || !body.team?.id) {
        throw new Error(
          `email mark all as read handler received no user id or team id`,
        );
      }
      const allowedAction = await gmailSubscriptionsManager.showPaywallIfNeeded(
        body.user.id,
        body.team?.id,
        'mark_all_as_read',
        { logger: logger, body: body, client: client },
      );
      if (!allowedAction) {
        return;
      }
      await markAllAsRead({ logger, body }, eventsEmitter, mailId);
      analyticsManager.gmailUserAction({
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: 'mark_all_as_read',
        extraParams: {
          mailId,
        },
      });
    } catch (e) {
      logger.error(`error in markAllAsReadHandler for user ${body.user.id}`, e);
      eventsEmitter.emit(DISPLAY_ERROR_MODAL_EVENT_NAME, {
        triggerId: body.trigger_id,
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: 'mark_all_as_read',
      } as IMailErrorMetaData);
      throw e;
    }
  };

export const markAllAsRead = async (
  { logger, body }: SectionActionProps,
  eventsEmitter: EventEmitter,
  mailId: string,
) => {
  logger.debug(`mark all as read handler for user ${body.user.id}`);
  if (!body.team?.id) {
    throw new Error(
      `team id not exist for user ${body.user.id} in markAllAsReadHandler`,
    );
  }

  // We assume the archive worked in order to be faster ux in 99% of the cases
  eventsEmitter.emit(ON_MESSAGE_CLEARED_EVENT_NAME, {
    id: mailId,
    slackUserId: body.user.id,
    slackTeamId: body.team.id,
  } as OnMessageClearedEvent);

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
    throw new Error(
      `email markAllAsReadHandler wasn't able to mark as read for user ${body.user.id} with response ${response.status}`,
    );
  }
};
