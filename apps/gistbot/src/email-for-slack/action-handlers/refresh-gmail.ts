import axios from 'axios';
import {
  UPDATE_EMAIL_REFRESH_METADATA_EVENT_NAME,
  UpdateEmailRefreshMetadataEvent,
} from '../../home/types';
import { SlackBlockActionWrapper, ViewAction } from '../../slack/types';
import { MAIL_BOT_SERVICE_API } from '../types';
import EventEmitter = require('events');
import { AnalyticsManager } from '@base/gistbot-shared';

const REFRESH_PATH = '/mail/gmail-client';

export const sendRefreshRequestToMailbot = async (
  slackUserId: string,
  slackTeamId: string,
  eventEmitter: EventEmitter,
) => {
  try {
    eventEmitter.emit(UPDATE_EMAIL_REFRESH_METADATA_EVENT_NAME, {
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
      metadata: {
        refreshing: true,
      },
    } as UpdateEmailRefreshMetadataEvent);
    const url = new URL(MAIL_BOT_SERVICE_API);
    url.pathname = REFRESH_PATH;
    await axios.post(url.toString(), {
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
    });
  } catch (e) {
    eventEmitter.emit(UPDATE_EMAIL_REFRESH_METADATA_EVENT_NAME, {
      slackUserId: slackUserId,
      slackTeamId: slackTeamId ?? '',
      metadata: {
        refreshing: false,
        error: 'Error refreshing Gmail',
      },
    } as UpdateEmailRefreshMetadataEvent);
    throw e;
  }
};

export const refreshActionHandler =
  (eventEmitter: EventEmitter, analyticsManager: AnalyticsManager) =>
  async ({ ack, logger, body }: SlackBlockActionWrapper) => {
    await ack();
    const userId = body.user.id;

    try {
      logger.debug(`refreshing gmail for ${userId}`);
      if (!body.team?.id) {
        logger.error(`team id not exist for user ${userId} in refreshGmail`);
        return;
      }
      try {
        analyticsManager.buttonClicked({
          type: 'gmail_action_refresh',
          slackTeamId: body.team?.id,
          slackUserId: userId,
        });
      } catch (ex) {
        logger.error(
          `Failed to send analytics,gmail_action_refresh,userId ${userId}, error:  ${ex}`,
        );
      }
      await sendRefreshRequestToMailbot(
        body.user.id,
        body.team.id,
        eventEmitter,
      );
    } catch (e) {
      logger.error(
        `Failed refreshing for ${body.user.id} in refreshGmail ${e}`,
      );
      throw e;
    }
  };

export const refreshFromModalHandler =
  (eventEmitter: EventEmitter) =>
  async ({ ack, logger, body }: ViewAction) => {
    await ack();

    try {
      logger.debug(`refreshing gmail for ${body.user.id}`);
      if (!body.team?.id) {
        logger.error(
          `team id not exist for user ${body.user.id} in refreshGmail`,
        );
        return;
      }
      await sendRefreshRequestToMailbot(
        body.user.id,
        body.team.id,
        eventEmitter,
      );
    } catch (e) {
      logger.error(
        `team id not exist for user ${body.user.id} in refreshGmail`,
      );
      throw e;
    }
  };
