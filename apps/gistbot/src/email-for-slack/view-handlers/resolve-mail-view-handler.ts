import { AnalyticsManager } from '@base/gistbot-shared';
import { ViewClosedAction, ViewSubmitAction } from '@slack/bolt';
import EventEmitter = require('events');
import {
  OnMessageClearedEvent,
  ON_MESSAGE_CLEARED_EVENT_NAME,
} from '../../home/types';
import { ViewAction } from '../../slack/types';
import { resolveMail } from '../mailbot/resolve-mail';
import { ResolveActionConfig, ResolveMailAction } from '../types';

export const resolveMailViewHandler =
  (analyticsManager: AnalyticsManager, eventEmitter: EventEmitter) =>
  async ({ ack, logger, body }: ViewAction) => {
    logger.info('received view action of type resolve mail');
    await ack();
    try {
      const { slackUserId, slackTeamId } = getSlackIds(body);
      const { id: messageId, submitAction, category } = getParamsFromBody(body);
      if (!submitAction || !(submitAction in ResolveActionConfig)) {
        throw new Error('no submit action');
      }

      logger.info('Resolve action: ', submitAction);
      analyticsManager.gmailUserAction({
        slackUserId,
        slackTeamId,
        action: submitAction,
        extraParams: {
          messageId,
          category,
        },
      });

      // We assume the archive worked in order to be faster ux in 99% of the cases
      eventEmitter.emit(ON_MESSAGE_CLEARED_EVENT_NAME, {
        id: messageId,
        slackUserId,
        slackTeamId,
      } as OnMessageClearedEvent);

      await resolveMail(submitAction as ResolveMailAction, {
        slackUserId,
        slackTeamId,
        messageId,
      });

      logger.info('successfully resolved mail');
    } catch (e) {
      logger.error(`error in resolve mail handler for user ${body.user.id}`, e);
      throw e;
    }
  };

const getSlackIds = (body: ViewSubmitAction | ViewClosedAction) => {
  const slackUserId = body.user.id;
  const slackTeamId = body.team?.id;
  if (!slackUserId) {
    throw new Error('resolve mail handler received no user id');
  }

  if (!slackTeamId) {
    throw new Error('resolve mail handler received no tean id');
  }

  return {
    slackUserId,
    slackTeamId,
  };
};

const getParamsFromBody = (body: ViewSubmitAction | ViewClosedAction) => {
  return JSON.parse(body.view.private_metadata);
};
