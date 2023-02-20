import { SlackBlockActionWrapper } from '../../slack/types';
import { ReadMoreView } from '../views/email-read-more-view';

export const emailReadMoreHandler =
  () =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    try {
      await ack();
      logger.debug(`handling read-more modal for ${body.user.id}`);
      const action = body.actions[0];
      if (action.type !== 'button') {
        throw new Error('emailReadMoreHandler received non-button action');
      }
      const [modalTitle, modalBody] = titleAndBodyFromValue(action.value);

      await client.views.open({
        trigger_id: body.trigger_id,
        view: ReadMoreView({
          title: modalTitle,
          body: modalBody,
        }),
      });
    } catch (e) {
      logger.error(
        `error in emailReadMoreHandler for user ${body.user.id}, ${e}`,
      );
      throw e;
    }
  };

function titleAndBodyFromValue(value: string): string[] {
  const index = value.indexOf('|');
  if (index < 0) {
    throw new Error(
      'emailReadMoreHandler received bad titleAndBody value, could not find | character',
    );
  }

  const title = value.substring(0, index);
  const body = value.substring(index + 1);
  return [title, body];
}
