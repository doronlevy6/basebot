import { logger } from '@base/logger';
import { SlashCommand } from '@slack/bolt';
import { AnalyticsManager } from '@base/gistbot-shared';
import { addToChannel } from '../slack/add-to-channel';
import { SchedulerSettingsModal } from '../slack/components/scheduler-settings-modal';
import {
  SlackBlockActionWrapper,
  SlackSlashCommandWrapper,
  ViewAction,
} from '../slack/types';
import { SchedulerSettingsManager } from './scheduler-manager';
import { UserSchedulerOptions, UserSchedulerSettings } from './types';
import { SlackDataStore } from '../utils/slack-data-store';
import { SchedulerSettingsDisableModal } from '../slack/components/disable-digest-modal';
import { calculateUserDefaultHour } from '../utils/time-utils';
import { ConversationsInfoResponse } from '@slack/web-api';

export const summarySchedularSettingsButtonHandler =
  (
    schedulerSettingsMgr: SchedulerSettingsManager,
    analyticsManager: AnalyticsManager,
    showInsideModal?: boolean,
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

      const userSettings = await schedulerSettingsMgr.fetchUserSettings(
        userId,
        teamId,
      );

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

      if (showInsideModal) {
        await client.views.push({
          trigger_id: body.trigger_id,
          view: SchedulerSettingsModal(enabled, selectedHour, channels),
        });
      } else {
        await client.views.open({
          trigger_id: body.trigger_id,
          view: SchedulerSettingsModal(enabled, selectedHour, channels),
        });
      }

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
    slackDataStore: SlackDataStore,
  ) =>
  async (params: ViewAction) => {
    const { ack, body, client, view } = params;
    try {
      await ack();

      logger.debug(`scheduler modal submited for user ${body.user.id}`);
      const selectedChannels =
        view.state.values['multi_conversations_select'].value
          .selected_conversations;
      if (!selectedChannels?.length) {
        logger.error(
          `no channels were selected in scheduler settings modal for user ${body.user.id}`,
        );
        return;
      }

      logger.debug(
        `scheduler modal selected channels ${selectedChannels} for user ${body.user.id}`,
      );
      if (!body.team?.id) {
        logger.error(
          `team id not exist for user ${body.user.id} in scheduler settings modal`,
        );
        return;
      }
      const validChannels = await getValidChannels(selectedChannels, client);

      if (selectedChannels.length > validChannels.length) {
        const chanelNotJoined = postMessage(
          client,
          body,
          selectedChannels,
          validChannels,
        );
        logger.info(
          `sending message 'invite bot to private channels ${chanelNotJoined.join(
            ',',
          )}' for user ${body.user.id} `,
        );

        if (!validChannels.length) {
          logger.info(
            `we didnt save changes for user ${body.user.id} becouse there are no valid chanells in scheduler settings `,
          );
          return;
        }
      }

      const joinChannelsPromises = validChannels.map(async (c) => {
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

      logger.debug(`scheduler modal joined channels for user ${body.user.id}`);

      const userInfo = await slackDataStore.getUserInfoData(
        body.user.id,
        body.team.id,
        client,
      );
      if (userInfo.tz_offset === undefined) {
        logger.error(
          `could not fetch user: ${body.user.id} info to get timezone in summary scheduler modal`,
        );
        return;
      }

      logger.debug(
        `scheduler modal fetched user info and timezone for user ${body.user.id}`,
      );
      const selectedHour =
        view.state.values['radio-buttons-time'].value.selected_option?.value ===
        UserSchedulerOptions.MORNING
          ? Number(UserSchedulerOptions.MORNING)
          : Number(UserSchedulerOptions.EVENING);

      const usersettings = new UserSchedulerSettings();
      usersettings.slackUser = body.user.id;
      usersettings.slackTeam = body.team?.id;
      usersettings.enabled =
        view.state.values['radio-buttons-switch'].value.selected_option
          ?.value === UserSchedulerOptions.ON
          ? true
          : false;

      if (!usersettings.enabled) {
        analyticsManager.scheduleSettingsDigestStopped({
          slackUserId: usersettings.slackUser,
          slackTeamId: usersettings.slackTeam,
        });
      }
      usersettings.timeHour = calculateUserDefaultHour(
        userInfo.tz_offset,
        selectedHour,
      );
      usersettings.selectedHour = selectedHour;
      const channelsInfos = await Promise.all(
        validChannels.map((c) => {
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
            `error fetching channel info when submitting scheduelr settings modal for user ${body.user.id}`,
          );
          return;
        }
      }
      logger.debug(
        `scheduler modal fetched channels info for user ${body.user.id}`,
      );
      usersettings.channels = channelsInfos.map((channelInfo) => {
        return {
          channelId: channelInfo.channel?.id as string,
          channelName: channelInfo.channel?.name as string,
        };
      });
      usersettings.days = [0, 1, 2, 3, 4, 5, 6];
      logger.debug(
        `scheduler modal start saving user settings ${usersettings},  for user ${body.user.id}`,
      );
      await schedulerSettingsMgr.saveUserSchedulerSettings(usersettings);
      logger.debug(
        `successfully saved user ${body.user.id} settings from scheduler settings modal`,
      );

      analyticsManager.buttonClicked({
        type: 'scheduler-settings-modal-submit',
        slackTeamId: body.team?.id || 'unknown',
        slackUserId: body.user.id,
      });
    } catch (ex) {
      logger.error(
        `error occured in scheduler settings modal for user ${body.user.id}, error:  ${ex}`,
      );
    }
  };

export const summarySchedularSettingsDisableHandler =
  (
    schedulerSettingsMgr: SchedulerSettingsManager,
    analyticsManager: AnalyticsManager,
  ) =>
  async (params: ViewAction) => {
    const { ack, body } = params;
    try {
      await ack();
      if (!body.team?.id || !body.user?.id) {
        logger.error(
          `no teamId or userId in handler for summarySchedularSettingsDisableHandler ${JSON.stringify(
            body,
          )}`,
        );
        return;
      }
      analyticsManager.scheduleSettingsDigestStopped({
        slackUserId: body.user.id,
        slackTeamId: body.team.id,
      });
      await schedulerSettingsMgr.disableSchedulerSettings(
        body.user.id,
        body.team.id,
      );
    } catch (err) {
      logger.error(
        `schedule settings disabled error for user ${body.user.id}: ${err} ${err.stack}`,
      );
    }
  };

export async function getValidChannels(selectedChannels: string[], client) {
  const selectedChannelsPromiseInfo: Array<Promise<ConversationsInfoResponse>> =
    selectedChannels.map((c: string) => {
      return client.conversations.info({ channel: c });
    });

  const results: Array<PromiseSettledResult<ConversationsInfoResponse>> =
    await Promise.allSettled(selectedChannelsPromiseInfo);

  const validChannels: string[] = results
    .filter(
      (result: PromiseSettledResult<ConversationsInfoResponse>) =>
        result.status === 'fulfilled',
    )
    .map(
      (result: PromiseFulfilledResult<ConversationsInfoResponse>) =>
        result.value?.channel?.id ?? '',
    )
    .filter((channel) => channel !== '');
  return validChannels;
}

export function postMessage(client, body, selectedChannels, validChannels) {
  const chanelNotJoined: string[] = [];
  for (const value of selectedChannels) {
    if (!validChannels.includes(value)) chanelNotJoined.push(`<#${value}> `);
  }
  let message = '';
  if (chanelNotJoined.length === 1) {
    message = `Hello, ${body.user.name}\n\n*${chanelNotJoined}* is a private channel.\nThe Daily Digest can show a private channel only if theGist is invited to it.
     \n\nTo add a private channel to your Daily Digest:\n1. Use the \`/invite @theGist\` command in ${chanelNotJoined}.
     \n2. Tap the Daily Digest Settings button *or* type \`/gist settings\` to open the settings and add the private channel again.`;
  } else {
    message = `Hello, ${body.user.name}\n\n*${chanelNotJoined.join(
      ' & ',
    )}* are private channels.\nThe Daily Digest can show private channels only if theGist is invited to each.\n\nTo add private channels to your Daily Digest:\n1. Use the \`/invite @theGist\` command in the following channels: ${chanelNotJoined.join(
      ' & ',
    )}.
     \n2. Tap the Daily Digest Settings button *or* type \`/gist settings\` to open the settings and add the private channels again.`;
  }
  if (chanelNotJoined.length) {
    client.chat.postMessage({
      channel: body.user.id,
      text: message,
    });
  }
  return chanelNotJoined;
}

export const summarySchedularSettingsDisableOpenModal =
  (analyticsManager: AnalyticsManager) =>
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
          `no teamId or userId in handler for summarySchedularSettingsDisableOpenModal ${JSON.stringify(
            body,
          )}`,
        );
        return;
      }

      await client.views.open({
        trigger_id: body.trigger_id,
        view: SchedulerSettingsDisableModal(),
      });

      analyticsManager.buttonClicked({
        type: 'scheduler-settings-disable-modal-open',
        slackTeamId: teamId,
        slackUserId: userId,
      });
    } catch (err) {
      logger.error(`schedule settings load error: ${err} ${err.stack}`);
    }
  };
