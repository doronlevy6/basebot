import { SlackBlockActionWrapper } from '../slack/types';
import { ReplyMailView } from './email-reply-view';
import { Routes } from '../routes/router';

export const emailReplyHandler =
  () =>
  async ({ ack, logger, body, client, action }: SlackBlockActionWrapper) => {
    try {
      const action = body.actions[0];
      if (action.type !== 'button') {
        throw new Error('email reply handler received non-button action');
      }

      const value = action.value;
      const valuesArray = value.split('|');

      await client.views.open({
        trigger_id: body.trigger_id,
        view: ReplyMailView({
          submitCallback: Routes.GISTLY_MODAL_SUBMIT,
          address: valuesArray[1],
        }),
      });
    } catch (e) {
      logger.error(e);
    }
  };
