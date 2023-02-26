import { AnalyticsManager } from '@base/gistbot-shared';
import { ButtonAction } from '@slack/bolt';
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
  async (props: SlackBlockActionWrapper) => {
    await props.ack();
    const action = props.body.actions[0] as ButtonAction;
    if (action.type !== 'button') {
      throw new Error(
        `markAllAsReadHandler received non-button action for user ${props.body.user.id}`,
      );
    }

    let isError = false;
    const mailId = action.value;
    try {
      isError = await markAllAsRead(props, eventsEmitter, mailId);
    } catch (e) {
      isError = true;
      props.logger.error(
        `error in markAllAsReadHandler for user ${props.body.user.id}, ${e}`,
      );
      // TODO: Show error modal
      throw e;
    } finally {
      analyticsManager.gmailUserAction({
        slackUserId: props.body.user.id,
        slackTeamId: props.body.team?.id || '',
        action: 'mark_all_as_read',
        extraParams: {
          isError,
          mailId,
        },
      });
    }
  };

export const markAllAsRead = async (
  { logger, body }: SlackBlockActionWrapper,
  eventsEmitter: EventEmitter,
  mailId: string,
) => {
  let isError = false;
  logger.debug(`mark all as read handler for user ${body.user.id}`);
  if (!body.team?.id) {
    isError = true;
    logger.error(
      `team id not exist for user ${body.user.id} in markAllAsReadHandler`,
    );
    return isError;
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

    return isError;
  }

  eventsEmitter.emit(ON_MESSAGE_CLEARED_EVENT_NAME, {
    id: mailId,
    slackUserId: body.user.id,
    slackTeamId: body.team.id,
  } as OnMessageClearedEvent);

  return isError;
};
