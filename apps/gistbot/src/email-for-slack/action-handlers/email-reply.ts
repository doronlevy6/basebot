import { AnalyticsManager } from '@base/gistbot-shared';
import axios from 'axios';
import { Routes } from '../../routes/router';
import { SlackBlockActionWrapper, ViewAction } from '../../slack/types';
import {
  ReplyMailView,
  REPLY_BLOCK_ID,
  REPLY_ELEMENT_ACTION_ID,
} from '../views/email-reply-view';
import { EmailCategory, MAIL_BOT_SERVICE_API } from '../types';
import { GmailSubscriptionsManager } from '../gmail-subscription-manager/gmail-subscription-manager';
import { DISPLAY_ERROR_MODAL_EVENT_NAME } from '../../home/types';
import { IMailErrorMetaData } from '../views/email-error-view';
import {
  ActionsBlock,
  Button,
  KnownBlock,
  ViewSubmitAction,
} from '@slack/bolt';
import { EventEmitter } from 'events';
import { getModalViewFromBody } from './helpers';

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
            category: valuesArray[2],
          }),
        }),
      });
    } catch (e) {
      logger.error(`error in emailReplyHandler for user ${body.user.id}, ${e}`);
      throw e;
    }
  };

export const emailReplyFromModalHandler =
  (analyticsManager: AnalyticsManager) =>
  async (params: SlackBlockActionWrapper) => {
    const { ack, body, logger, client } = params;
    try {
      await ack();
      const slackUserId = body.user.id;
      const slackTeamId = body.team?.id;
      if (!slackTeamId) {
        logger.error(
          `team id not exist for user ${slackUserId} in emailReplyFromModalHandler`,
        );
        return;
      }

      const metadata = body.view?.private_metadata;
      if (!metadata) {
        logger.error(
          `PRIVATE metadata not exist for user ${slackUserId} in emailReplyFromModalHandler`,
        );
        return;
      }

      const { id: threadId, from, category } = JSON.parse(metadata);
      const message =
        body?.view?.state.values[REPLY_BLOCK_ID][REPLY_ELEMENT_ACTION_ID]
          ?.value || '';

      await sendReplyToMailbot(
        { slackUserId, slackTeamId, threadId, message, to: from },
        analyticsManager,
        category,
      );

      const view = getModalViewFromBody(body);
      if (view) {
        const blocks = view.blocks.map((b: KnownBlock) =>
          b.type === 'actions'
            ? {
                ...b,
                elements: (b as ActionsBlock).elements.map((e) =>
                  e.action_id === Routes.MAIL_REPLY_FROM_MODAL
                    ? {
                        ...e,
                        text: {
                          ...(e as Button).text,
                          text: ':white_check_mark: Sent',
                        },
                      }
                    : e,
                ),
              }
            : b,
        );
        await client.views.update({
          view_id: body.view?.id,
          view: { ...view, blocks },
        });
      }
    } catch (e) {
      logger.error(
        `error in emailReplyFromModalHandler for user ${body.user.id} ${e}`,
        e,
      );
      throw e;
    }
  };

export const emailReplySubmitHandler =
  (analyticsManager: AnalyticsManager, eventsEmitter: EventEmitter) =>
  async (params: ViewAction) => {
    const { ack, body, view, logger } = params;
    try {
      await ack();
      logger.debug(`reply submit handler for user ${body.user.id}`);
      const slackUserId = body.user.id;
      const slackTeamId = body.team?.id;
      if (!slackTeamId) {
        logger.error(
          `team id not exist for user ${slackUserId} in emailReplySubmitHandler`,
        );
        return;
      }
      const {
        id: threadId,
        from,
        category,
      } = JSON.parse(body.view.private_metadata);
      const message =
        view.state.values[REPLY_BLOCK_ID][REPLY_ELEMENT_ACTION_ID]?.value || '';
      await sendReplyToMailbot(
        { slackUserId, slackTeamId, threadId, message, to: from },
        analyticsManager,
        category,
      );
    } catch (e) {
      logger.error(
        `error in emailReplySubmitHandler for user ${body.user.id} ${e}`,
        e,
      );
      eventsEmitter.emit(DISPLAY_ERROR_MODAL_EVENT_NAME, {
        triggerId: (body as ViewSubmitAction).trigger_id,
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: 'reply',
      } as IMailErrorMetaData);
      throw e;
    }
  };

interface ReplyProps {
  slackUserId: string;
  slackTeamId: string;
  to: string;
  threadId: string;
  message: string;
}

const sendReplyToMailbot = async (
  props: ReplyProps,
  analyticsManager: AnalyticsManager,
  category: EmailCategory,
) => {
  const { slackUserId, slackTeamId, to, threadId, message } = props;
  const url = new URL(MAIL_BOT_SERVICE_API);
  url.pathname = REPLY_PATH;
  await axios.post(
    url.toString(),
    {
      slackUserId,
      slackTeamId,
      to,
      threadId,
      message,
    },
    {
      timeout: 60000,
    },
  );
  analyticsManager.gmailUserAction({
    slackUserId,
    slackTeamId,
    action: 'reply',
    extraParams: {
      threadId,
      category,
    },
  });
};
