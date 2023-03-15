import { AnalyticsManager } from '@base/gistbot-shared';
import { BlockAction, BlockElementAction } from '@slack/bolt';
import EventEmitter = require('events');
import {
  DISPLAY_ERROR_MODAL_EVENT_NAME,
  OnMessageClearedEvent,
  ON_MESSAGE_CLEARED_EVENT_NAME,
} from '../../home/types';
import { SlackBlockActionWrapper } from '../../slack/types';
import { GmailSubscriptionsManager } from '../gmail-subscription-manager/gmail-subscription-manager';
import { resolveMail } from '../mailbot/resolve-mail';
import { ResolveActionConfig, ResolveMailAction } from '../types';
import { IMailErrorMetaData } from '../views/email-error-view';

export const resolveMailActionHandler =
  (
    analyticsManager: AnalyticsManager,
    eventEmitter: EventEmitter,
    gmailSubscriptionsManager: GmailSubscriptionsManager,
  ) =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    logger.info('received action of type resolve mail');
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

      const allowedAction = await gmailSubscriptionsManager.showPaywallIfNeeded(
        slackUserId,
        slackTeamId,
        submitAction,
        { logger, body, client },
      );

      if (!allowedAction) {
        return;
      }

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
      eventEmitter.emit(DISPLAY_ERROR_MODAL_EVENT_NAME, {
        triggerId: body.trigger_id,
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: 'resolve-mail',
      } as IMailErrorMetaData);
      throw e;
    }
  };

const getSlackIds = (body: BlockAction<BlockElementAction>) => {
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

const getParamsFromBody = (body: BlockAction<BlockElementAction>) => {
  const action = body.actions[0];
  if (action.type === 'button') {
    return JSON.parse(action.value);
  }

  if (action.type === 'overflow') {
    return JSON.parse(action.selected_option.value);
  }

  throw new Error(
    `email archiveHandler received unsupported action for user ${body.user.id}`,
  );
};
