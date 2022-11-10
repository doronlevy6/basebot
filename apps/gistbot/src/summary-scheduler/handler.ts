import { logger } from '@base/logger';
import { AnalyticsManager } from '../analytics/manager';
import { addToChannel } from '../slack/add-to-channel';
import { SchedulerSettingsModal } from '../slack/components/scheduler-settings-modal';
import { SlackBlockActionWrapper, ViewAction } from '../slack/types';
import { SchedulerSettingsManager } from './scheduler-manager';
import { UserSchedulerOptions, UserSchedulerSettings } from './types';

export const summarySchedularSettingsButtonHandler =
  (
    schedulerSettingsMgr: SchedulerSettingsManager,
    analyticsManager: AnalyticsManager,
  ) =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    try {
      await ack();
      if (!body.state?.values || !body.team) {
        logger.error(
          `no content for user action found in scheduler button handler`,
        );
        return;
      }

      const userSettingsPromise = schedulerSettingsMgr.fetchUserSettings(
        body.user.id,
        body.team.id,
      );
      const userInfoPromise = client.users.info({ user: body.user.id });
      const [userSettings, userInfo] = await Promise.all([
        userSettingsPromise,
        userInfoPromise,
      ]);
      if (
        !userInfo ||
        !userInfo.ok ||
        userInfo.error ||
        !userInfo.user?.tz_offset
      ) {
        logger.error(
          `could not fetch user: ${body.user.id} info to get timezone in summary scheduler button handler`,
        );
        return;
      }
      let enabled:
        | UserSchedulerOptions.ON
        | UserSchedulerOptions.OFF
        | undefined;
      let hour:
        | UserSchedulerOptions.MORNING
        | UserSchedulerOptions.EVENING
        | undefined;
      let channels: string[] | undefined;

      if (userSettings) {
        enabled = userSettings?.enabled
          ? UserSchedulerOptions.ON
          : UserSchedulerOptions.OFF;
        const date = new Date();
        date.setUTCHours(Number(UserSchedulerOptions.MORNING), 0, 0);
        hour =
          date.getUTCHours() ===
          userSettings.timeHour + userInfo.user.tz_offset / 3600
            ? UserSchedulerOptions.MORNING
            : UserSchedulerOptions.EVENING;

        channels = userSettings.channels.map((c) => c.channelId);
      }

      await client.views.open({
        trigger_id: body.trigger_id,
        view: SchedulerSettingsModal(enabled, hour, channels),
      });

      analyticsManager.buttonClicked({
        type: 'scheduler-settings-button',
        slackTeamId: body.team?.id || 'unknown',
        slackUserId: body.user.id,
      });
    } catch (err) {
      logger.error(`user feedback submit handler error: ${err.stack}`);
    }
  };

export const summarySchedularSettingsModalHandler =
  (
    schedulerSettingsMgr: SchedulerSettingsManager,
    analyticsManager: AnalyticsManager,
  ) =>
  async (params: ViewAction) => {
    try {
      const { ack, body, client, view } = params;

      const selectedChannels =
        view.state.values['multi_conversations_select'].value
          .selected_conversations;
      if (!selectedChannels?.length) {
        logger.error('no channels were selected in scheduler settings modal');
        ack({
          response_action: 'errors',
          errors: {
            multi_conversations_select: 'channels must be selected',
          },
        });
        return;
      }

      if (!body.team?.id) {
        logger.error(
          `team id not exist for user ${body.user.id} in scheduler settings modal`,
        );
        ack({
          response_action: 'errors',
          errors: {
            multi_conversations_select: 'team id not exist for user',
          },
        });
        return;
      }

      await ack();

      const joinChannelsPromises = selectedChannels.map((c) => {
        return addToChannel(
          client,
          {
            channelId: c,
            currentUser: body.user.id,
            teamId: body.team?.id as string,
          },
          analyticsManager,
        );
      });

      await Promise.all(joinChannelsPromises);

      const userInfo = await client.users.info({ user: body.user.id });
      if (
        !userInfo ||
        !userInfo.ok ||
        userInfo.error ||
        !userInfo.user?.tz_offset
      ) {
        logger.error(
          `could not fetch user: ${body.user.id} info to get timezone in summary scheduler modal`,
        );
        return;
      }

      const requestedHour =
        view.state.values['radio-buttons-time'].value.selected_option?.value ===
        UserSchedulerOptions.MORNING
          ? Number(UserSchedulerOptions.MORNING)
          : Number(UserSchedulerOptions.EVENING);
      const date = new Date();
      date.setUTCHours(requestedHour, 0, 0);
      const userSettingsHour =
        date.getUTCHours() - userInfo.user.tz_offset / 3600;

      const usersettings = new UserSchedulerSettings();
      usersettings.slackUser = body.user.id;
      usersettings.slackTeam = body.team?.id;
      usersettings.enabled =
        view.state.values['radio-buttons-switch'].value.selected_option
          ?.value === UserSchedulerOptions.ON
          ? true
          : false;
      usersettings.timeHour = userSettingsHour;
      usersettings.channels = selectedChannels.map((c) => {
        return { channelId: c };
      });
      usersettings.days = [0, 1, 2, 3, 4, 5, 6];
      await schedulerSettingsMgr.saveUserSchedulerSettings(usersettings);
      logger.debug(
        `saved user ${body.user.id} settings from scheduler settings modal`,
      );

      analyticsManager.buttonClicked({
        type: 'scheduler-settings-modal-submit',
        slackTeamId: body.team?.id || 'unknown',
        slackUserId: body.user.id,
      });
    } catch (ex) {
      logger.error(`error occured in scheduler settings modal, error:  ${ex}`);
    }
  };
