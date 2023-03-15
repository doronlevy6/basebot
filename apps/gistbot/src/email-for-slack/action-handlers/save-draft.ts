import { AnalyticsManager } from '@base/gistbot-shared';
import axios from 'axios';
import { SlackBlockActionWrapper } from '../../slack/types';
import {
  REPLY_BLOCK_ID,
  REPLY_ELEMENT_ACTION_ID,
} from '../views/email-reply-view';
import { MAIL_BOT_SERVICE_API } from '../types';
import { GmailSubscriptionsManager } from '../gmail-subscription-manager/gmail-subscription-manager';
import { DISPLAY_ERROR_MODAL_EVENT_NAME } from '../../home/types';
import { EventEmitter } from 'events';
import { getModalViewFromBody } from './helpers';
import { ActionsBlock, Button, KnownBlock } from '@slack/web-api';
import { Routes } from '../../routes/router';

const CREATE_DRAFT_PATH = '/mail/gmail-client/createDraft';

export const saveDraft =
  (
    analyticsManager: AnalyticsManager,
    gmailSubscriptionsManager: GmailSubscriptionsManager,
    eventsEmitter: EventEmitter,
  ) =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    await ack();
    let threadId = '';
    try {
      logger.debug(`save draft handler for user ${body.user.id}`);
      if (!body.team?.id) {
        throw new Error(
          `team id not exist for user ${body.user.id} in saveDraft`,
        );
      }
      if (!body.user.id || !body.team?.id) {
        throw new Error(
          `email save draft handler received no user id or team id`,
        );
      }
      const allowedAction = await gmailSubscriptionsManager.showPaywallIfNeeded(
        body.user.id,
        body.team?.id,
        'save_draft',
        { logger, body, client },
      );
      if (!allowedAction) {
        return;
      }
      const action = body.actions[0];
      if (action.type !== 'button') {
        throw new Error(
          `email saveDraft handler received non-button action for user  ${body.user.id}`,
        );
      }
      const message =
        body.view?.state.values[REPLY_BLOCK_ID][REPLY_ELEMENT_ACTION_ID]?.value;
      const { id, from, category } = JSON.parse(
        body.view?.private_metadata || '',
      );
      threadId = id;
      const url = new URL(MAIL_BOT_SERVICE_API);
      url.pathname = CREATE_DRAFT_PATH;

      await axios.post(
        url.toString(),
        {
          slackUserId: body.user.id,
          slackTeamId: body.team.id,
          to: from,
          message,
          threadId,
        },
        {
          timeout: 60000,
        },
      );
      analyticsManager.gmailUserAction({
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: 'save_draft',
        extraParams: {
          threadId,
          category,
        },
      });

      const view = getModalViewFromBody(body);
      if (view) {
        const blocks = view.blocks.map((b: KnownBlock) =>
          b.type === 'actions'
            ? {
                ...b,
                elements: (b as ActionsBlock).elements.map((e) =>
                  e.action_id === Routes.MAIL_SAVE_DRAFT
                    ? {
                        ...e,
                        text: {
                          ...(e as Button).text,
                          text: ':white_check_mark: Saved as Draft',
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
      logger.error(`error in saveDraft for user ${body.user.id}`, e);
      eventsEmitter.emit(DISPLAY_ERROR_MODAL_EVENT_NAME, {
        triggerId: body.trigger_id,
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: 'save_draft',
      });
      throw e;
    }
  };
