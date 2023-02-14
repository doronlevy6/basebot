import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import axios from 'axios';
import { SlackDataStore } from '../../utils/slack-data-store';
import { calculateUserDefaultHour } from '../../utils/time-utils';
import { MAIL_BOT_SERVICE_API } from '../types';
import { CreateUsersSettingDto, UserSchedulerOptions } from './types';

const SAVE_USER_SETTINGS_PATH = '/mail/users-settings/save';

export const saveDefaultEmailDigestSettings = async (
  slackUserId: string,
  slackTeamId: string,
  email: string,
  client: WebClient,
  slackDataStore: SlackDataStore,
) => {
  try {
    const userInfo = await slackDataStore.getUserInfoData(
      slackUserId,
      slackTeamId,
      client,
    );
    if (userInfo?.tz_offset === undefined) {
      logger.error(
        `could not fetch user: ${slackUserId} info to get timezone when saving default user settings to email digest`,
      );
      return;
    }

    const userSettings = new CreateUsersSettingDto();
    userSettings.userId = email;
    userSettings.enabled = true;
    userSettings.selectedHour = Number(UserSchedulerOptions.MORNING);
    userSettings.timeHour = calculateUserDefaultHour(
      userInfo.tz_offset,
      Number(UserSchedulerOptions.MORNING),
    );
    userSettings.days = [0, 1, 2, 3, 4, 5, 6];
    const url = new URL(MAIL_BOT_SERVICE_API);
    url.pathname = SAVE_USER_SETTINGS_PATH;
    await axios.post(url.toString(), userSettings, {
      timeout: 60000,
    });
  } catch (e) {
    logger.error(
      `could not save default email scheduled digest settings for user email: ${email}, slackUser: ${slackUserId}, ${e}`,
    );
    throw e;
  }
};
