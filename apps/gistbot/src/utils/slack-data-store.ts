import { RedisUtil } from '@base/utils';
import { User } from '@slack/web-api/dist/response/UsersInfoResponse';
import { WebClient } from '@slack/web-api';
import { Profile } from '@slack/web-api/dist/response/UsersProfileGetResponse';
import { logger } from '@base/logger';

const TTL = 60 * 60; // One Hour
const BASE_USERS_INFO_KEY = 'user_info';
const BASE_USERS_PROFILE_KEY = 'user_profile';

type SlackEntity = User | Profile;

export class SlackDataStore extends RedisUtil {
  private async set(
    slackEntity: SlackEntity,
    key: string,
    teamId: string,
    slackEntityType: string,
  ): Promise<{ key: string }> {
    const fullKey = this.fullKey(key, teamId, slackEntityType);
    await this.db.set(fullKey, JSON.stringify(slackEntity), 'EX', TTL);
    return { key };
  }

  private async get(
    key: string,
    teamId: string,
    slackEntityType: string,
  ): Promise<SlackEntity | null> {
    const data = await this.db.get(this.fullKey(key, teamId, slackEntityType));
    if (!data) {
      return null;
    }
    return JSON.parse(data);
  }

  private fullKey(key: string, teamId: string, slackEntityType: string) {
    return [this.env, slackEntityType, key, teamId].join(':');
  }

  async getUserInfoData(
    userId: string,
    teamId: string,
    client: WebClient,
  ): Promise<User> {
    const userData = await this.get(userId, teamId, BASE_USERS_INFO_KEY);
    if (userData) {
      logger.debug(`cache hit for user_info request for user ${userId}`);
      return userData as User;
    }
    logger.debug(
      `cache miss for user_info request for user ${userId}, fetching data from slack api`,
    );
    const {
      error: infoError,
      ok: infoOk,
      user: userInfo,
    } = await client.users.info({
      user: userId,
    });
    if (infoError || !infoOk) {
      throw new Error(`Failed to fetch user from slack ${infoError}`);
    }

    if (!userInfo) {
      throw new Error(`Failed to fetch user from slack , user not found`);
    }
    await this.set(userInfo, userId, teamId, BASE_USERS_INFO_KEY);
    return userInfo;
  }

  async getUserProfileData(
    userId: string,
    teamId: string,
    client: WebClient,
  ): Promise<Profile> {
    const userData = await this.get(userId, teamId, BASE_USERS_PROFILE_KEY);
    if (userData) {
      logger.debug(`cache hit for user_profile request for user ${userId}`);
      return userData as Profile;
    }
    logger.debug(
      `cache miss for user_profile request for user ${userId}, fetching data from slack api`,
    );
    const {
      error: infoError,
      ok: infoOk,
      profile: userProfile,
    } = await client.users.profile.get({
      user: userId,
    });
    if (infoError || !infoOk) {
      throw new Error(`Failed to fetch user profile from slack ${infoError}`);
    }

    if (!userProfile) {
      throw new Error(
        `Failed to fetch user profile from slack , user not found`,
      );
    }
    await this.set(userProfile, userId, teamId, BASE_USERS_PROFILE_KEY);
    return userProfile;
  }
}
