import axios from 'axios';
import { SlackBlockActionWrapper } from '../../slack/types';
import { replayElementActionID, replyBlockId } from '../email-reply-view';
import { MAIL_BOT_SERVICE_API } from '../types';

const CREATE_DRAFT_PATH = '/mail/gmail-client/createDraft';

export const saveDraft =
  () =>
  async ({ ack, logger, body }: SlackBlockActionWrapper) => {
    await ack();
    try {
      logger.debug(`save draft handler for user ${body.user.id}`);
      if (!body.team?.id) {
        logger.error(`team id not exist for user ${body.user.id} in saveDraft`);
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

      const url = new URL(MAIL_BOT_SERVICE_API);
      url.pathname = CREATE_DRAFT_PATH;

      await axios.post(
        url.toString(),
        {
          slackUserId: body.user.id,
          slackTeamId: body.team.id,
          to: from,
          message,
          threadId: id,
        },
        {
          timeout: 60000,
        },
      );
    } catch (e) {
      logger.error(`error in saveDraft for user ${body.user.id}, ${e}`);
      throw e;
    }
  };
