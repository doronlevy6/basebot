import { EventEmitter } from 'events';
import { HomeDataStore } from '../../home/home-data-store';
import { DISPLAY_ERROR_MODAL_EVENT_NAME } from '../../home/types';
import { SlackBlockActionWrapper } from '../../slack/types';
import { DigestMessage } from '../types';
import { ReadMoreView } from '../views/email-read-more-view';

export const emailReadMoreHandler =
  (homeStore: HomeDataStore, eventsEmitter: EventEmitter) =>
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

      const title =
        message.attachments?.length || 0 > 0
          ? 'Read more :paperclip:'
          : 'Read more';
      await client.views.open({
        trigger_id: body.trigger_id,
        view: ReadMoreView({
          title: title,
          body: message.readMoreBody,
          attachments: message.attachments,
        }),
      });
    } catch (e) {
      logger.error(
        `error in emailReadMoreHandler for user ${body.user.id}, ${e}`,
      );
      eventsEmitter.emit(DISPLAY_ERROR_MODAL_EVENT_NAME, {
        triggerId: body.trigger_id,
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: 'read_more',
      });
      throw e;
    }
  };
