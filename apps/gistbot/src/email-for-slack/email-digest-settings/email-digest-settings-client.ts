import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import axios from 'axios';
import { SlackDataStore } from '../../utils/slack-data-store';
import { calculateUserDefaultHour } from '../../utils/time-utils';
import { MAIL_BOT_SERVICE_API } from '../types';
import {
  DEFAULT_EMAIL_DIGEST_DAYS,
  EmailDigestUsersSettingsEntity,
  EmailSchedulerOptions,
  IAuthenticationMetadata,
} from './types';

const USER_SETTINGS_PATH = '/mail/users-settings';
const SAVE_USER_SETTINGS_PATH = USER_SETTINGS_PATH + '/save';
const GET_USER_SETTINGS_PATH = USER_SETTINGS_PATH + '/get-user-settings';
const UPDATE_VIA_GMAIL_URL = USER_SETTINGS_PATH + '/update-mail-account-index';

export const getEmailDigestSettings = async (
  slackUserId: string,
  slackTeamId: string,
): Promise<EmailDigestUsersSettingsEntity> => {
  const url = new URL(MAIL_BOT_SERVICE_API);
  url.pathname = GET_USER_SETTINGS_PATH;

  console.log(`${url.toString()} ${slackUserId} ${slackTeamId}`);
  const res = await axios.post(url.toString(), { slackUserId, slackTeamId });

  const userSettings = res.data?.settings as EmailDigestUsersSettingsEntity;
  return userSettings;
};

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

    const auth: IAuthenticationMetadata = {
      slackTeamId,
      slackUserId,
    };

    const userSettings = new EmailDigestUsersSettingsEntity();
    userSettings.userId = email;
    userSettings.enabled = true;
    userSettings.selectedHour = Number(EmailSchedulerOptions.MORNING);
    userSettings.timeHour = calculateUserDefaultHour(
      userInfo.tz_offset,
      Number(EmailSchedulerOptions.MORNING),
    );
    userSettings.days = DEFAULT_EMAIL_DIGEST_DAYS;
    const url = new URL(MAIL_BOT_SERVICE_API);
    url.pathname = SAVE_USER_SETTINGS_PATH;
    await axios.post(
      url.toString(),
      { ...userSettings, ...auth },
      {
        timeout: 60000,
      },
    );
  } catch (e) {
    logger.error(
      `could not save default email scheduled digest settings for user email: ${email}, slackUser: ${slackUserId}, ${e}`,
    );
    throw e;
  }
};

export const saveEmailDigestSettings = async (
  authMetadata: IAuthenticationMetadata,
  userSettings: EmailDigestUsersSettingsEntity,
) => {
  try {
    const url = new URL(MAIL_BOT_SERVICE_API);
    url.pathname = SAVE_USER_SETTINGS_PATH;
    await axios.post(
      url.toString(),
      { ...userSettings, ...authMetadata },
      {
        timeout: 60000,
      },
    );
  } catch (e) {
    logger.error(
      `could not save default email scheduled digest settings for user email: ${authMetadata.slackTeamId} ${authMetadata.slackUserId}, ${e}`,
    );
    throw e;
  }
};

export const updateAccountUsingGmailIUrl = async (
  authMetadata: IAuthenticationMetadata,
  gmailLink: string,
) => {
  try {
    const url = new URL(MAIL_BOT_SERVICE_API);
    url.pathname = UPDATE_VIA_GMAIL_URL;
    await axios.post(
      url.toString(),
      { ...authMetadata, gmailUrl: gmailLink },
      {
        timeout: 60000,
      },
    );
  } catch (e) {
    logger.error(
      `could not update email index settings for user email: ${authMetadata.slackTeamId} ${authMetadata.slackUserId} ${gmailLink}, ${e}`,
    );
    throw e;
  }
};
