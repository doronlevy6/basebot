import { logger } from '@base/logger';
import { AnalyticsManager } from '../analytics/manager';
import { Routes } from '../routes/router';
import { addToChannel } from './add-to-channel';
import { SlackBlockActionWrapper, ViewAction } from './types';

export const addToChannelFromWelcomeModal =
  (analyticsManager: AnalyticsManager) => async (params: ViewAction) => {
    const { ack, body } = params;

    try {
      await ack();

      const submitted = body.type === 'view_submission';

      analyticsManager.modalClosed({
        type: 'add_to_channels_from_welcome',
        slackUserId: body.user.id,
        slackTeamId: body.user.team_id || 'unknown',
        submitted: submitted,
      });
    } catch (err) {
      logger.error(`Add to channel from welcome modal error: ${err.stack}`);
    }
  };

export const addToChannelFromWelcomeHandler =
  (analyticsManager: AnalyticsManager) =>
  async ({ ack, logger, payload, body, client }: SlackBlockActionWrapper) => {
    try {
      await ack();

      if (payload.type !== 'multi_conversations_select') {
        throw new Error(
          `received ${payload.type} instead of multi_conversations_select in addToChannelFromSelectHandler handler`,
        );
      }

      logger.info(
        `${body.user.id} is adding the bot to channels ${payload.selected_conversations}`,
      );

      await Promise.all(
        payload.selected_conversations.map((c) =>
          addToChannel(
            client,
            {
              currentUser: body.user.id,
              channelId: c,
              teamId: body.user.team_id || 'unknown',
            },
            analyticsManager,
          ),
        ),
      );
    } catch (error) {
      logger.error(`error in add to channel from select: ${error.stack}`);
    }
  };

export const addToChannelFromWelcomeModalHandler =
  (analyticsManager: AnalyticsManager) =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    try {
      await ack();

      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: Routes.ADD_TO_CHANNEL_FROM_WELCOME_SUBMIT,
          submit: {
            type: 'plain_text',
            text: 'Add me to these channels',
            emoji: true,
          },
          close: {
            type: 'plain_text',
            text: 'Close',
            emoji: true,
          },
          title: {
            type: 'plain_text',
            text: `Add theGist to channels`,
            emoji: true,
          },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Select channels to add me to:',
              },
              accessory: {
                type: 'multi_conversations_select',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select a channel...',
                  emoji: true,
                },
                filter: {
                  include: ['public'],
                  exclude_bot_users: true,
                  exclude_external_shared_channels: true,
                },
                action_id: Routes.ADD_TO_CHANNEL_FROM_WELCOME,
              },
            },
          ],
        },
      });

      analyticsManager.modalView({
        type: 'add_to_channels_from_welcome',
        slackUserId: body.user.id,
        slackTeamId: body.user.team_id || 'unknown',
      });
    } catch (error) {
      logger.error(`error in add to channel from welcome: ${error.stack}`);
    }
  };
