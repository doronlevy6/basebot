import { AnalyticsManager } from '@base/gistbot-shared';
import axios from 'axios';
import {
  OnMessageClearedEvent,
  ON_MESSAGE_CLEARED_EVENT_NAME,
} from '../../home/types';
import { SlackBlockActionWrapper } from '../../slack/types';
import { MAIL_BOT_SERVICE_API } from '../types';
import EventEmitter = require('events');

const ARCHIVE_ALL_PATH = '/mail/bulk-actions/archive';

export const archiveAllHandler =
  (analyticsManager: AnalyticsManager, eventEmitter: EventEmitter) =>
  async (props: SlackBlockActionWrapper) => {
    await props.ack();
    const action = props.body.actions[0];
    if (action.type !== 'button') {
      throw new Error(
        `archiveAllHandler received non-button action for user ${props.body.user.id}`,
      );
    }

    let isError = false;
    const mailId = action.value;
    try {
      isError = await archiveAll(props, eventEmitter, mailId);
    } catch (e) {
      isError = true;
      // TODO: Show error modal
      props.logger.error(
        `error in archiveAllHandler for user ${props.body.user.id}, ${e}`,
      );
      throw e;
    } finally {
      analyticsManager.gmailUserAction({
        slackUserId: props.body.user.id,
        slackTeamId: props.body.team?.id || '',
        action: 'archive_all',
        extraParams: {
          groupId: mailId,
          isError,
        },
      });
    }
  };

export const archiveAll = async (
  { logger, body }: SlackBlockActionWrapper,
  eventEmitter: EventEmitter,
  mailId: string,
) => {
  let isError = false;
  logger.debug(`archive all handler for user ${body.user.id}`);
  if (!body.team?.id) {
    isError = true;
    logger.error(
      `team id not exist for user ${body.user.id} in archiveAllHandler`,
    );
    return isError;
  }

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
    // TODO: Show error modal
    return isError;
  }

  eventEmitter.emit(ON_MESSAGE_CLEARED_EVENT_NAME, {
    id: mailId,
    slackUserId: body.user.id,
    slackTeamId: body.team.id,
  } as OnMessageClearedEvent);

  return isError;
};
