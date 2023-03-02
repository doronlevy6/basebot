import { AnalyticsManager, PgInstallationStore } from '@base/gistbot-shared';
import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { DISPLAY_ERROR_MODAL_EVENT_NAME } from './types';
import { EventEmitter } from 'events';
import {
  IMailErrorMetaData,
  MailErrorView,
} from '../email-for-slack/views/email-error-view';
import { Routes } from '../routes/router';
import { ModalView } from '@slack/bolt';

export class ErrorsManager {
  constructor(
    private installationStore: PgInstallationStore,
    private eventsEmitter: EventEmitter,
    private analyticsManager: AnalyticsManager,
  ) {
    this.eventsEmitter.on(
      DISPLAY_ERROR_MODAL_EVENT_NAME,
      this.onDisplayErrorModalNotification,
    );
  }

  async showErrorModal(metadata: IMailErrorMetaData) {
    const { slackTeamId, slackUserId } = metadata;
    const view = MailErrorView(Routes.REFRESH_GMAIL_FROM_VIEW);
    try {
      const client = await this.createClient(slackTeamId);
      try {
        await this.openErrorModal(client, metadata, view);
        logger.info(
          `home showed error modal for ${slackUserId} in ${slackTeamId}...`,
        );
      } catch (e) {
        await this.fallback(client, view, slackUserId);
        logger.info(
          `sent error message as fallback: ${slackUserId} in ${slackTeamId}...`,
        );
      }
    } catch (err) {
      logger.error(
        `error getting client installation for user:${slackUserId} in ${slackTeamId}, error: ${err}`,
      );
    }
  }

  private async openErrorModal(
    client: WebClient,
    metadata: IMailErrorMetaData,
    view: ModalView,
  ) {
    await client.views.open({
      trigger_id: metadata.triggerId,
      view: view,
    });
  }

  private async fallback(
    client: WebClient,
    view: ModalView,
    slackUserId: string,
  ) {
    await client.chat.postMessage({
      blocks: view.blocks,
      channel: slackUserId,
    });
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

  private onDisplayErrorModalNotification = (metadata: IMailErrorMetaData) => {
    logger.debug(
      `received display error modal notification ${JSON.stringify(metadata)}`,
    );
    this.analyticsManager.gmailUserAction({
      slackUserId: metadata.slackUserId,
      slackTeamId: metadata.slackTeamId,
      action: metadata.action,
      extraParams: {
        isError: true,
      },
    });

    this.showErrorModal(metadata).catch((err) =>
      logger.error(`error displaying error modal: ${err}`),
    );
  };
}
