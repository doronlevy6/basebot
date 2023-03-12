import { EventEmitter } from 'events';
import { HomeDataStore } from '../../home/home-data-store';
import { DISPLAY_ERROR_MODAL_EVENT_NAME } from '../../home/types';
import { SlackBlockActionWrapper } from '../../slack/types';
import {
  DigestMessage,
  EmailCategory,
  ResolveActionConfig,
  ResolveMailAction,
} from '../types';
import { ReadMoreView } from '../views/email-read-more-view';

const title = 'Open';

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

      if (!message.link) {
        logger.error(
          `no link to original email was found for user ${body.user.id} in emailReadMoreHandler`,
        );
        return;
      }

      const submitAction = message.actions.find(
        (a) => a in ResolveActionConfig,
      );

      if (!submitAction) {
        logger.error(
          `no resolve action found for ${message.id} in emailReadMoreHandler`,
        );
        return;
      }

      await client.views.open({
        trigger_id: body.trigger_id,
        view: ReadMoreView({
          title,
          body: message.readMoreBody,
          attachments: message.attachments,
          from: message.from,
          messageId: message.id,
          link: message.link as string,
          submitAction: submitAction as ResolveMailAction,
          category:
            message?.relatedMails?.[0]?.classifications?.[0].type ||
            EmailCategory.Priority,
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
