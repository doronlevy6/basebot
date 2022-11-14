import { logger } from '@base/logger';
import { SlashCommand } from '@slack/bolt';
import { AnalyticsManager } from '../analytics/manager';
import { addToChannel } from '../slack/add-to-channel';
import { SchedulerSettingsModal } from '../slack/components/scheduler-settings-modal';
import {
  SlackBlockActionWrapper,
  SlackSlashCommandWrapper,
  ViewAction,
} from '../slack/types';
import { SchedulerSettingsManager } from './scheduler-manager';
import { UserSchedulerOptions, UserSchedulerSettings } from './types';

export const summarySchedularSettingsButtonHandler =
  (
    schedulerSettingsMgr: SchedulerSettingsManager,
    analyticsManager: AnalyticsManager,
  ) =>
  async ({
    ack,
    logger,
    body,
    client,
  }: SlackBlockActionWrapper | SlackSlashCommandWrapper) => {
    try {
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

      const userSettingsPromise = schedulerSettingsMgr.fetchUserSettings(
        userId,
        teamId,
      );
      const userInfoPromise = client.users.info({ user: userId });
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
      let selectedHour:
        | UserSchedulerOptions.MORNING
        | UserSchedulerOptions.EVENING
        | undefined;
      let channels: string[] | undefined;

      if (userSettings) {
        enabled = userSettings?.enabled
          ? UserSchedulerOptions.ON
          : UserSchedulerOptions.OFF;
        selectedHour =
          userSettings.selectedHour === Number(UserSchedulerOptions.MORNING)
            ? UserSchedulerOptions.MORNING
            : UserSchedulerOptions.EVENING;

        channels = userSettings.channels.map((c) => c.channelId);
      }

      await client.views.open({
        trigger_id: body.trigger_id,
        view: SchedulerSettingsModal(enabled, selectedHour, channels),
      });

      analyticsManager.buttonClicked({
        type: 'scheduler-settings-button',
        slackTeamId: teamId,
        slackUserId: userId,
      });
    } catch (err) {
      logger.error(`schedule settings load error: ${err} ${err.stack}`);
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
        await ack({
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
        await ack({
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

      const selectedHour =
        view.state.values['radio-buttons-time'].value.selected_option?.value ===
        UserSchedulerOptions.MORNING
          ? Number(UserSchedulerOptions.MORNING)
          : Number(UserSchedulerOptions.EVENING);
      const date = new Date();
      date.setUTCHours(selectedHour, 0, 0);
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
      usersettings.selectedHour = selectedHour;
      const channelsInfos = await Promise.all(
        selectedChannels.map((c) => {
          return client.conversations.info({ channel: c });
        }),
      );

      for (const channelInfo of channelsInfos) {
        if (
          !channelInfo.ok ||
          channelInfo.error ||
          !channelInfo.channel?.id ||
          !channelInfo.channel?.name
        ) {
          logger.error(
            `error fetching channel info when submitting scheduelr settings modal`,
          );
          return;
        }
      }

      usersettings.channels = channelsInfos.map((channelInfo) => {
        return {
          channelId: channelInfo.channel?.id as string,
          channelName: channelInfo.channel?.name as string,
        };
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
