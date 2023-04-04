import { AnalyticsManager } from '@base/gistbot-shared';
import { showEmailDigestSettingsModal } from '../email-for-slack/email-digest-settings/email-digest-settings-modal-handler';
import { HomeDataStore } from '../home/home-data-store';
import { AllSettingsModal } from '../slack/components/all-settings-modal';
import {
  SlackBlockActionWrapper,
  SlackSlashCommandWrapper,
} from '../slack/types';
import { summarySchedularSettingsButtonHandler } from '../summary-scheduler/handler';
import { SchedulerSettingsManager } from '../summary-scheduler/scheduler-manager';
import { DISPLAY_ERROR_MODAL_EVENT_NAME } from '../home/types';
import { EventEmitter } from 'events';
import { SlashCommand } from '@slack/bolt';

export const allSettingsButtonHandler =
  (homeDataStore: HomeDataStore, eventsEmitter: EventEmitter) =>
  async ({
    ack,
    logger,
    body,
    client,
  }: SlackBlockActionWrapper | SlackSlashCommandWrapper) => {
    const teamId = (body as SlashCommand).team_id ?? body.team?.id;
    const userId = (body as SlashCommand).user_id ?? body.user?.id;
    let userEmailEnabled = true;
    try {
      await ack();
      try {
        const userMailData = await homeDataStore.fetch({
          slackUserId: userId,
          slackTeamId: teamId,
        });
        userEmailEnabled = userMailData?.emailEnabled ?? true;
      } catch (fetchError) {
        logger.error(
          `Fetch userMailData error: ${fetchError} ${fetchError.stack}`,
        );
      }

      await client.views.open({
        trigger_id: body.trigger_id,
        view: AllSettingsModal(userEmailEnabled),
      });
    } catch (err) {
      logger.error(`all settings load error: ${err} ${err.stack}`);
      eventsEmitter.emit(DISPLAY_ERROR_MODAL_EVENT_NAME, {
        triggerId: body.trigger_id,
        slackUserId: userId,
        slackTeamId: teamId,
        action: 'open settings',
      });
    }
  };

export const openGmailSettingsFromAllSettings =
  (analyticsManager: AnalyticsManager) =>
  async (props: SlackBlockActionWrapper) => {
    await showEmailDigestSettingsModal(analyticsManager, true)(props);
  };

export const openSlackSettingsFromAllSettings =
  (
    analyticsManager: AnalyticsManager,
    schedulerSettingsManager: SchedulerSettingsManager,
  ) =>
  async (props: SlackBlockActionWrapper) => {
    await summarySchedularSettingsButtonHandler(
      schedulerSettingsManager,
      analyticsManager,
      true,
    )(props);
  };
