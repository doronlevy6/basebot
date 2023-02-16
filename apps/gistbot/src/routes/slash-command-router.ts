import { AnalyticsManager } from '@base/gistbot-shared';
import { showEmailDigestSettingsModal } from '../email-for-slack/email-digest-settings/email-digest-settings-modal-handler';
import { FeatureRateLimiter } from '../feature-rate-limiter/rate-limiter';
import { SlackSlashCommandWrapper } from '../slack/types';
import { isBaseTeamWorkspace, isItayOnLenny } from '../slack/utils';
import { channelSummarizationHandler } from '../summaries/channel-handler';
import { ChannelSummarizer } from '../summaries/channel/channel-summarizer';
import { MultiChannelSummarizer } from '../summaries/channel/multi-channel-summarizer';
import { summarySchedularSettingsButtonHandler } from '../summary-scheduler/handler';
import { SchedulerSettingsManager } from '../summary-scheduler/scheduler-manager';
import { getMailsCommand } from './slash-routes/get-mails-command';
import { connectGmailCommand } from './slash-routes/gmail-command';
import { helpCommand } from './slash-routes/help-command';
import { increaseLimitsCommand } from './slash-routes/increase-limits-command';
import { multiChannelSummaryCommand } from './slash-routes/multi-channel-summary-command';

export const slashCommandRouter = (
  channelSummarizer: ChannelSummarizer,
  analyticsManager: AnalyticsManager,
  featureRateLimiter: FeatureRateLimiter,
  schedulerSettingsMgr: SchedulerSettingsManager,
  multiChannelSummarizer: MultiChannelSummarizer,
) => {
  const singleChannelSummaryHandler = channelSummarizationHandler(
    analyticsManager,
    channelSummarizer,
    schedulerSettingsMgr,
  );

  const summarySchedulerSettings = summarySchedularSettingsButtonHandler(
    schedulerSettingsMgr,
    analyticsManager,
  );

  const showEmailSettings = showEmailDigestSettingsModal(analyticsManager);

  return async (props: SlackSlashCommandWrapper) => {
    const {
      ack,
      command: { text },
      logger,
      body: { user_id, team_id },
    } = props;

    logger.info(
      `Running command ${text} for user ${user_id} on team ${team_id}}`,
    );

    if (text === 'help') {
      await ack();
      await helpCommand(props);
      return;
    }

    if (text === 'gmail') {
      await ack();
      await connectGmailCommand(props);
      return;
    }

    if (text === 'get mails') {
      await ack();
      await getMailsCommand(props);
      return;
    }

    if (
      text === 'allow more' &&
      (isBaseTeamWorkspace(team_id) || isItayOnLenny(user_id, team_id))
    ) {
      await ack();
      await increaseLimitsCommand(props, featureRateLimiter);
      return;
    }

    if (text.startsWith('multi')) {
      await ack();
      await multiChannelSummaryCommand(props, multiChannelSummarizer);
      return;
    }

    if (text === 'settings') {
      await ack();
      await summarySchedulerSettings(props);
      return;
    }

    if (text === 'gmail-settings') {
      await ack();
      await showEmailSettings(props);
      return;
    }

    await singleChannelSummaryHandler(props);
  };
};
