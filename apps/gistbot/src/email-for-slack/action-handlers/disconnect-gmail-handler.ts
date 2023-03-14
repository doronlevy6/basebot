import { AnalyticsManager } from '@base/gistbot-shared';
import { HomeDataStore } from '../../home/home-data-store';
import { Routes } from '../../routes/router';
import { SlackBlockActionWrapper, ViewAction } from '../../slack/types';
import {
  getEmailDigestSettings,
  saveEmailDigestSettings,
} from '../email-digest-settings/email-digest-settings-client';

export const disconnectGmailHandler = async ({
  ack,
  logger,
  body,
  client,
}: SlackBlockActionWrapper) => {
  await ack();
  logger.info('recived action to disconnect from gmail');

  await client.views.update({
    user_id: body.user.id,
    view_id: body.view?.id,
    view: {
      callback_id: Routes.DISCONNECT_GMAIL_FROM_VIEW,
      type: 'modal',
      title: {
        type: 'plain_text',
        text: 'Warning',
      },
      submit: {
        type: 'plain_text',
        text: 'Yes',
      },
      close: {
        type: 'plain_text',
        text: 'No',
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Are you sure you want to disconnect?*',
          },
        },
      ],
    },
  });
};

export const disconnectGmailViewHandler =
  (homeDataStore: HomeDataStore, analyticsManager: AnalyticsManager) =>
  async ({ ack, logger, body }: ViewAction) => {
    await ack();
    logger.info('recived confirmed action to disconnect from gmail');
    const slackUserId = body.user.id;
    if (!slackUserId) {
      logger.error('could not find slack user id');
      return;
    }

    const slackTeamId = body.team?.id;
    if (!slackTeamId) {
      logger.error('could not find slack team id');
      return;
    }

    try {
      analyticsManager.disconnectEmail({ slackUserId, slackTeamId });
      const settings = await getEmailDigestSettings(slackUserId, slackTeamId);
      await saveEmailDigestSettings(
        { slackTeamId, slackUserId },
        { ...settings, enabled: false },
      );
      await homeDataStore.disconnectEmail({ slackTeamId, slackUserId });
    } catch (ex) {
      logger.error(
        `error disconnecting gmail for user ${body.user.id}, error:  ${ex}`,
      );
    }
  };
