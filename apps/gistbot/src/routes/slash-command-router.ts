import { AnalyticsManager } from '@base/gistbot-shared';
import { allSettingsButtonHandler } from '../all-settings/handler';
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
  const showAllSettings = allSettingsButtonHandler();

  return async (props: SlackSlashCommandWrapper) => {
    const {
      command: { text },
      logger,
      body: { user_id, team_id },
    } = props;

    logger.info(
      `Running command ${text} for user ${user_id} on team ${team_id}}`,
    );

    if (text === 'help') {
      await helpCommand(props);
      return;
    }

    if (text === 'gmail') {
      await connectGmailCommand(props, analyticsManager);
      return;
    }

    if (text === 'get mails') {
      await getMailsCommand(props);
      return;
    }

    if (
      text === 'allow more' &&
      (isBaseTeamWorkspace(team_id) || isItayOnLenny(user_id, team_id))
    ) {
      await increaseLimitsCommand(props, featureRateLimiter);
      return;
    }

    if (text.startsWith('multi')) {
      await multiChannelSummaryCommand(props, multiChannelSummarizer);
      return;
    }

    if (text === 'settings') {
      await summarySchedulerSettings(props);
      return;
    }

    if (text === 'gmail-settings') {
      await showEmailSettings(props);
      return;
    }

    if (text === 'all-settings') {
      await showAllSettings(props);
      return;
    }

    await singleChannelSummaryHandler(props);
  };
};
