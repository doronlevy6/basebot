import { PgInstallationStore } from '@base/gistbot-shared';
import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { PgSchedulerSettingsStore } from '../summary-scheduler/scheduler-store';
import { HomeDataStore } from './home-data-store';
import { IHomeState, UPDATE_HOME_EVENT_NAME } from './types';
import { AppHomeView, IHomeMetadata } from './views/app-home-view';
import { GmailSubscriptionsManager } from '../email-for-slack/gmail-subscription-manager/gmail-subscription-manager';
import EventEmitter = require('events');

export class AppHomeManager {
  constructor(
    private installationStore: PgInstallationStore,
    private digestSchedulerStore: PgSchedulerSettingsStore,
    private homeDataStore: HomeDataStore,
    private eventsEmitter: EventEmitter,
    private gmailSubscriptionsManager: GmailSubscriptionsManager,
  ) {
    this.eventsEmitter.on(
      UPDATE_HOME_EVENT_NAME,
      this.onHomeUpdateNotification,
    );
  }

  async updateHome(metadata: IHomeMetadata) {
    try {
      const { slackTeamId, slackUserId } = metadata;
      const state = await this.fetchState(metadata);
      const daysLeftFreeTrial =
        await this.gmailSubscriptionsManager.freeTrialDaysLeft(
          slackUserId,
          slackTeamId,
        );
      const blocks = AppHomeView(metadata, state, daysLeftFreeTrial);
      const client = await this.createClient(slackTeamId);
      await client.views.publish({
        user_id: slackUserId,
        view: {
          type: 'home',
          blocks,
        },
      });

      logger.info(
        `home successfully updated for ${slackUserId} in ${slackTeamId}...`,
      );
    } catch (err) {
      logger.error(`error updating home: ${err}`);
    }
  }

  private async fetchState({
    slackTeamId,
    slackUserId,
  }: IHomeMetadata): Promise<IHomeState> {
    const [slackDigestSettings, state] = await Promise.all([
      this.digestSchedulerStore.fetchUserSettings(slackUserId, slackTeamId),
      this.homeDataStore.fetch({ slackUserId, slackTeamId }),
    ]);
    const slackOnboarded = Boolean(
      slackDigestSettings && slackDigestSettings.channels?.length > 0,
    );
    if (!state) {
      logger.debug(
        `no state was found for ${slackUserId} in ${slackTeamId}...`,
      );
      return {
        slackOnboarded,
        gmailRefreshMetadata: { refreshing: false },
      };
    }

    return { ...state, slackOnboarded };
  }

  private async createClient(slackTeamId: string) {
    const installation = await this.installationStore.fetchInstallationByTeamId(
      slackTeamId,
    );
    const token = installation?.bot?.token;
    if (!token) {
      const errMsg = `no token was found for team ${slackTeamId} when updating home`;
      logger.error(errMsg);
      throw new Error(errMsg);
    }
    return new WebClient(token);
  }

  private onHomeUpdateNotification = (metadata: IHomeMetadata) => {
    logger.debug(
      `received home update notification ${JSON.stringify(metadata)}`,
    );

    this.updateHome(metadata).catch((err) =>
      logger.error(`error updating home: ${err}`),
    );
  };
}
