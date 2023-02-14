import { SlackBlockActionWrapper, ViewAction } from '../slack/types';
import { ReplyMailView } from './email-reply-view';
import { Routes } from '../routes/router';
import axios from 'axios';
import { MAIL_BOT_SERVICE_API } from './types';
import { ReadMoreView } from './email-read-more-view';

const REPLY_PATH = '/mail/gmail-client/sendReply';
const MARK_AS_READ_PATH = '/mail/gmail-client/markAsRead';
const MARK_ALL_AS_READ_PATH = '/mail/bulk-actions/mark-as-read';
const CREATE_DRAFT_PATH = '/mail/gmail-client/createDraft';

export const emailReplyHandler =
  () =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    try {
      await ack();
      logger.debug(`reply buttion handler for user ${body.user.id}`);
      const action = body.actions[0];
      if (action.type !== 'button') {
        throw new Error('email reply handler received non-button action');
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

export const emailReplySubmitHandler = () => async (params: ViewAction) => {
  const { ack, body, view, logger } = params;
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

    const url = new URL(MAIL_BOT_SERVICE_API);
    url.pathname = REPLY_PATH;

    await axios.post(
      url.toString(),
      {
        slackUserId: body.user.id,
        slackTeamId: body.team.id,
        to: from,
        threadId: id,
        message,
      },
      {
        timeout: 60000,
      },
    );
  } catch (e) {
    logger.error(
      `error in emailReplySubmitHandler for user ${body.user.id}, ${e}`,
    );
    throw e;
  }
};

export const markAsReadHandler =
  () =>
  async ({ ack, logger, body }: SlackBlockActionWrapper) => {
    await ack();
    try {
      logger.debug(`mark as read handler for user ${body.user.id}`);
      if (!body.team?.id) {
        logger.error(
          `team id not exist for user ${body.user.id} in markAsReadHandler`,
        );
        return;
      }

      const action = body.actions[0];
      if (action.type !== 'button') {
        throw new Error(
          `email markAsReadHandler received non-button action for user ${body.user.id}`,
        );
      }

      const mailId = action.value;
      const url = new URL(MAIL_BOT_SERVICE_API);
      url.pathname = MARK_AS_READ_PATH;

      await axios.post(
        url.toString(),
        {
          slackUserId: body.user.id,
          slackTeamId: body.team.id,
          id: mailId,
        },
        {
          timeout: 60000,
        },
      );
    } catch (e) {
      logger.error(`error in markAsReadHandler for user ${body.user.id}, ${e}`);
      throw e;
    }
  };

export const markAllAsReadHandler =
  () =>
  async ({ ack, logger, body }: SlackBlockActionWrapper) => {
    await ack();
    try {
      logger.debug(`mark all as read handler for user ${body.user.id}`);
      if (!body.team?.id) {
        logger.error(
          `team id not exist for user ${body.user.id} in markAllAsReadHandler`,
        );
        return;
      }

      const action = body.actions[0];
      if (action.type !== 'button') {
        throw new Error(
          `markAllAsReadHandler received non-button action for user ${body.user.id}`,
        );
      }

      const mailId = action.value;
      const url = new URL(MAIL_BOT_SERVICE_API);
      url.pathname = MARK_ALL_AS_READ_PATH;

      await axios.post(
        url.toString(),
        {
          slackUserId: body.user.id,
          slackTeamId: body.team.id,
          groupId: mailId,
        },
        {
          timeout: 60000,
        },
      );
    } catch (e) {
      logger.error(
        `error in markAllAsReadHandler for user ${body.user.id}, ${e}`,
      );
      throw e;
    }
  };

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
        body.view?.state.values['reply']['static_select-action'].selected_option
          ?.value;
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
