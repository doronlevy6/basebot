import { SlackBlockActionWrapper, ViewAction } from '../slack/types';
import { ReplyMailView } from './email-reply-view';
import { Routes } from '../routes/router';
import axios from 'axios';
import { MAIL_BOT_SERVICE_API } from './types';
import { ReadMoreView } from './email-read-more-view';
import { BlockAction, BlockElementAction, ButtonAction } from '@slack/bolt';
import { Block, Logger, WebClient } from '@slack/web-api';

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
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    await ack();
    const action = body.actions[0];
    if (action.type !== 'button') {
      throw new Error(
        `email markAsReadHandler received non-button action for user ${body.user.id}`,
      );
    }

    try {
      logger.debug(`mark as read handler for user ${body.user.id}`);
      if (!body.team?.id) {
        logger.error(
          `team id not exist for user ${body.user.id} in markAsReadHandler`,
        );
        return;
      }

      await updateMarkAsReadButton(body, action, logger, client, true);
      const mailId = action.value;
      const url = new URL(MAIL_BOT_SERVICE_API);
      url.pathname = MARK_AS_READ_PATH;

      const response = await axios.post(
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

      if (response.status !== 200 && response.status !== 201) {
        logger.error(
          `email markAsReadHandler wasn't able to mark as read for user ${body.user.id} with response ${response.status}`,
        );
        await updateMarkAsReadButton(body, action, logger, client, false);
      }
    } catch (e) {
      await updateMarkAsReadButton(body, action, logger, client, false);
      logger.error(`error in markAsReadHandler for user ${body.user.id}, ${e}`);
      throw e;
    }
  };

async function updateMarkAsReadButton(
  body: BlockAction<BlockElementAction>,
  action: ButtonAction,
  logger: Logger,
  client: WebClient,
  success: boolean,
) {
  const buttonText = success ? 'Read ✅' : 'Failed :(';
  const updatedBlocks = body.message?.blocks;
  let didFindButton = false;
  updatedBlocks.forEach((block) => {
    if (block.elements) {
      block.elements.forEach((element) => {
        if (
          element.type === 'button' &&
          element.value == action.value &&
          element.action_id == action.action_id
        ) {
          element.text.text = buttonText;
          didFindButton = true;
        }
      });
    }
  });

  if (!didFindButton) {
    logger.error(
      `email markAsReadHandler couldn't find button to update for user ${body.user.id}`,
    );
  }

  await updateBlocks(body, client, updatedBlocks, logger);
}

async function updateBlocks(
  body: BlockAction<BlockElementAction>,
  client: WebClient,
  updatedBlocks: Block[],
  logger: Logger,
) {
  const message_ts = body.message?.ts;
  const channel_id = body.channel?.id;
  if (message_ts && channel_id) {
    const response = await client.chat.update({
      channel: channel_id,
      ts: message_ts,
      blocks: updatedBlocks,
      attachments: [],
    });
    if (!response.ok) {
      logger.error(
        `error in markAsReadHandler, couldn't update blocks. Error: ${response.error}`,
      );
    }
  } else {
    logger.error(
      `error in markAsReadHandler, couldn't get message or channel ids for user ${body.user.id}`,
    );
  }
}

export const markAllAsReadHandler =
  () =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    await ack();
    const action = body.actions[0];
    if (action.type !== 'button') {
      throw new Error(
        `markAllAsReadHandler received non-button action for user ${body.user.id}`,
      );
    }

    try {
      logger.debug(`mark all as read handler for user ${body.user.id}`);
      if (!body.team?.id) {
        logger.error(
          `team id not exist for user ${body.user.id} in markAllAsReadHandler`,
        );
        return;
      }

      await updateMarkAsReadButton(body, action, logger, client, true);
      const mailId = action.value;
      const url = new URL(MAIL_BOT_SERVICE_API);
      url.pathname = MARK_ALL_AS_READ_PATH;

      const response = await axios.post(
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
      if (response.status !== 200 && response.status !== 201) {
        logger.error(
          `email markAllAsReadHandler wasn't able to mark as read for user ${body.user.id} with response ${response.status}`,
        );
        await updateMarkAsReadButton(body, action, logger, client, false);
      }
    } catch (e) {
      await updateMarkAsReadButton(body, action, logger, client, false);
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
