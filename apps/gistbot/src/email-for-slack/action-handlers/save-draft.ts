import { AnalyticsManager } from '@base/gistbot-shared';
import axios from 'axios';
import { SlackBlockActionWrapper } from '../../slack/types';
import { replayElementActionID, replyBlockId } from '../views/email-reply-view';
import { MAIL_BOT_SERVICE_API } from '../types';
import { GmailSubscriptionsManager } from '../gmail-subscription-manager/gmail-subscription-manager';

const CREATE_DRAFT_PATH = '/mail/gmail-client/createDraft';

export const saveDraft =
  (
    analyticsManager: AnalyticsManager,
    gmailSubscriptionsManager: GmailSubscriptionsManager,
  ) =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    await ack();

    let threadId = '';
    let isError = false;
    try {
      logger.debug(`save draft handler for user ${body.user.id}`);
      if (!body.team?.id) {
        logger.error(`team id not exist for user ${body.user.id} in saveDraft`);
        return;
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
        body.view?.state.values[replyBlockId][replayElementActionID]?.value;
      const { id, from } = JSON.parse(body.view?.private_metadata || '');
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
    } catch (e) {
      isError = true;
      logger.error(`error in saveDraft for user ${body.user.id}, ${e}`);
      throw e;
    } finally {
      analyticsManager.gmailUserAction({
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: 'save_draft',
        extraParams: {
          isError,
          threadId,
        },
      });
    }
  };
