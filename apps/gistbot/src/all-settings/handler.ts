import { AnalyticsManager } from '@base/gistbot-shared';
import { showEmailDigestSettingsModal } from '../email-for-slack/email-digest-settings/email-digest-settings-modal-handler';
import { AllSettingsModal } from '../slack/components/all-settings-modal';
import {
  SlackBlockActionWrapper,
  SlackSlashCommandWrapper,
} from '../slack/types';
import { summarySchedularSettingsButtonHandler } from '../summary-scheduler/handler';
import { SchedulerSettingsManager } from '../summary-scheduler/scheduler-manager';

export const allSettingsButtonHandler =
  () =>
  async ({
    ack,
    logger,
    body,
    client,
  }: SlackBlockActionWrapper | SlackSlashCommandWrapper) => {
    try {
      await ack();
      await client.views.open({
        trigger_id: body.trigger_id,
        view: AllSettingsModal(),
      });
    } catch (err) {
      logger.error(`schedule settings load error: ${err} ${err.stack}`);
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
