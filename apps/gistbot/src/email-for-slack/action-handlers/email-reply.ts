import { AnalyticsManager } from '@base/gistbot-shared';
import axios from 'axios';
import { Routes } from '../../routes/router';
import { SlackBlockActionWrapper, ViewAction } from '../../slack/types';
import { ReplyMailView } from '../views/email-reply-view';
import { MAIL_BOT_SERVICE_API } from '../types';
import { GmailSubscriptionsManager } from '../gmail-subscription-manager/gmail-subscription-manager';

const REPLY_PATH = '/mail/gmail-client/sendReply';

export const emailReplyHandler =
  (gmailSubscriptionsManager: GmailSubscriptionsManager) =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    try {
      await ack();
      logger.debug(`reply buttion handler for user ${body.user.id}`);
      const action = body.actions[0];
      if (action.type !== 'button') {
        throw new Error('email reply handler received non-button action');
      }
      if (!body.user.id || !body.team?.id) {
        throw new Error(`email reply handler received no user id or team id`);
      }
      const allowedAction = await gmailSubscriptionsManager.showPaywallIfNeeded(
        body.user.id,
        body.team?.id,
        'reply',
        { logger, body, client },
      );
      if (!allowedAction) {
        return;
      }
      const value = action.value;
      const valuesArray = value.split('|');

      await client.views.open({
        trigger_id: body.trigger_id,
        view: ReplyMailView({
          submitCallback: Routes.MAIL_REPLY_SUBMIT,
          address: valuesArray[1],
          metadata: JSON.stringify({
            id: valuesArray[0],
            from: valuesArray[1],
          }),
        }),
      });
    } catch (e) {
      logger.error(`error in emailReplyHandler for user ${body.user.id}, ${e}`);
      throw e;
    }
  };

export const emailReplySubmitHandler =
  (analyticsManager: AnalyticsManager) => async (params: ViewAction) => {
    const { ack, body, view, logger } = params;

    let threadId = '';
    let isError = false;
    try {
      await ack();
      logger.debug(`reply submit handler for user ${body.user.id}`);
      if (!body.team?.id) {
        logger.error(
          `team id not exist for user ${body.user.id} in emailReplySubmitHandler`,
        );
        return;
      }

      const { id, from } = JSON.parse(body.view.private_metadata);
      const message = view.state.values['reply']['reply-text']?.value;
      threadId = id;
      const url = new URL(MAIL_BOT_SERVICE_API);
      url.pathname = REPLY_PATH;

      await axios.post(
        url.toString(),
        {
          slackUserId: body.user.id,
          slackTeamId: body.team.id,
          to: from,
          threadId,
          message,
        },
        {
          timeout: 60000,
        },
      );
    } catch (e) {
      isError = true;
      logger.error(
        `error in emailReplySubmitHandler for user ${body.user.id}, ${e}`,
      );
      throw e;
    } finally {
      analyticsManager.gmailUserAction({
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: 'reply',
        extraParams: {
          threadId,
          isError,
        },
      });
    }
  };
