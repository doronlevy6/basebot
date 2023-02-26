import { HomeDataStore } from '../../home/home-data-store';
import { SlackBlockActionWrapper } from '../../slack/types';
import { DigestMessage } from '../types';
import { ReadMoreView } from '../views/email-read-more-view';

const maxModalCharCount = 3000;

export const emailReadMoreHandler =
  (homeStore: HomeDataStore) =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    try {
      await ack();
      logger.debug(`handling read-more modal for ${body.user.id}`);
      const action = body.actions[0];
      if (!body.team?.id) {
        logger.error(
          `team id not exist for user ${body.user.id} in emailReadMoreHandler`,
        );
        return;
      }

      if (action.type !== 'button') {
        throw new Error('emailReadMoreHandler received non-button action');
      }

      const data = await homeStore.fetch({
        slackUserId: body.user.id,
        slackTeamId: body.team.id,
      });
      const sections = data?.gmailDigest?.digest.sections;
      if (!sections) {
        logger.error(
          `no gmail digest was found for user ${body.user.id} in emailReadMoreHandler`,
        );
        return;
      }

      let message: DigestMessage | undefined;
      for (const section of sections) {
        message = section.messages.find((msg) => {
          return msg.id === action.value;
        });

        if (message) {
          break;
        }
      }

      if (!message || !message.readMoreBody) {
        logger.error(
          `no message to read more was found for user ${body.user.id} in emailReadMoreHandler`,
        );
        return;
      }
      message.readMoreBody = message.readMoreBody.substring(
        0,
        maxModalCharCount,
      );
      await client.views.open({
        trigger_id: body.trigger_id,
        view: ReadMoreView({
          title: 'Read more',
          body: message.readMoreBody,
        }),
      });
    } catch (e) {
      logger.error(
        `error in emailReadMoreHandler for user ${body.user.id}, ${e}`,
      );
      throw e;
    }
  };
