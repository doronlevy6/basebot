import { AnalyticsManager } from '@base/gistbot-shared';
import { logger } from '@base/logger';
import { SlashCommand } from '@slack/bolt';
import {
  SlackBlockActionWrapper,
  SlackSlashCommandWrapper,
  ViewAction,
} from '../../slack/types';
import { SlackDataStore } from '../../utils/slack-data-store';
import { calculateUserDefaultHour } from '../../utils/time-utils';
import { EmailSettingsModal } from './email-settings-modal';

import {
  getEmailDigestSettings,
  saveEmailDigestSettings,
} from './email-digest-settings-client';
import {
  DEFAULT_EMAIL_DIGEST_DAYS,
  EmailDigestUsersSettingsEntity,
  EmailSchedulerOptions,
  EmailWorkMode,
} from './types';

const DEFAULT_SELECTED_HOUR = Number(EmailSchedulerOptions.MORNING);

export const showEmailDigestSettingsModal =
  (analyticsManager: AnalyticsManager, showInsideModal?: boolean) =>
  async ({
    ack,
    logger,
    body,
    client,
  }: SlackBlockActionWrapper | SlackSlashCommandWrapper) => {
    try {
      logger.debug(`Showing email digest modal ${body}`);

      await ack();
      const teamId = (body as SlashCommand).team_id ?? body.team?.id;
      const userId = (body as SlashCommand).user_id ?? body.user?.id;
      if (!teamId || !userId) {
        logger.error(
          `no teamId or userId in handler for summarySchedularSettingsButtonHandler ${JSON.stringify(
            body,
          )}`,
        );
        return;
      }

      const userSettings = await getEmailDigestSettings(userId, teamId);

      logger.debug(
        `email scheduler modal fetched user settings for user ${userId} ${JSON.stringify(
          userSettings,
        )}`,
      );
      const workMode = userSettings.workMode;
      const timeFrame = userSettings.timeFrame;

      if (showInsideModal) {
        await client.views.push({
          trigger_id: body.trigger_id,
          view: EmailSettingsModal(userSettings.userId, workMode, timeFrame),
        });
      } else {
        await client.views.open({
          trigger_id: body.trigger_id,
          view: EmailSettingsModal(userSettings.userId, workMode, timeFrame),
        });
      }

      analyticsManager.buttonClicked({
        type: 'email-digest-settings-button',
        slackTeamId: teamId,
        slackUserId: userId,
      });
    } catch (err) {
      logger.error(`email schedule settings load error: ${err} ${err.stack}`);
    }
  };

export const saveEmailDigestSettingsHandler =
  (analyticsManager: AnalyticsManager, slackDataStore: SlackDataStore) =>
  async (params: ViewAction) => {
    const { ack, body, client, view } = params;
    try {
      await ack();

      logger.debug(
        `email scheduler modal submited for user ${
          body.user.id
        } ${JSON.stringify(body)}`,
      );

      if (!body.team?.id) {
        logger.error(
          `team id not exist for user ${body.user.id} in email scheduler settings modal`,
        );
        return;
      }

      const userInfo = await slackDataStore.getUserInfoData(
        body.user.id,
        body.team.id,
        client,
      );
      if (userInfo.tz_offset === undefined) {
        logger.error(
          `could not fetch user: ${body.user.id} info to get timezone in email summary scheduler modal`,
        );
        return;
      }
      logger.debug(
        `email scheduler modal fetched user info and timezone for user ${body.user.id}`,
      );
      const workModeSelected =
        view.state.values['work-mode-select']['radio_buttons-action']
          .selected_option?.value === EmailWorkMode.MarkAsRead
          ? EmailWorkMode.MarkAsRead
          : EmailWorkMode.Archive;
      const timeFrameSelected =
        view.state.values['timeframe-select']['static_select-action']
          .selected_option?.value;
      const timeFrameToSave = timeFrameSelected ? Number(timeFrameSelected) : 1;
      const selectedHour = DEFAULT_SELECTED_HOUR;

      const usersettings = new EmailDigestUsersSettingsEntity();
      usersettings.enabled = true;
      usersettings.timeHour = calculateUserDefaultHour(
        userInfo.tz_offset,
        selectedHour,
      );
      usersettings.selectedHour = selectedHour;
      usersettings.days = DEFAULT_EMAIL_DIGEST_DAYS;
      usersettings.workMode = workModeSelected;
      usersettings.timeFrame = timeFrameToSave;

      await saveEmailDigestSettings(
        { slackTeamId: body.team.id, slackUserId: body.user.id },
        usersettings,
      );

      logger.debug(
        `successfully saved user ${body.user.id} settings from email scheduler settings modal`,
      );

      analyticsManager.buttonClicked({
        type: 'email-digest-settings-modal-submit',
        slackTeamId: body.team?.id,
        slackUserId: body.user.id,
      });
    } catch (ex) {
      logger.error(
        `error occured in email scheduler settings modal for user ${body.user.id}, error:  ${ex}`,
      );
    }
  };
