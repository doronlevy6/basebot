import { App, directMention, InstallationStore, subtype } from '@slack/bolt';
import { AnalyticsManager } from '@base/gistbot-shared';
import { appHomeOpenedHandler } from '../onboarding/app-home-opened-handler';
import { OnboardingManager } from '../onboarding/manager';
import { addToChannelHandler } from '../slack/add-to-channel';
import {
  addToChannelsFromWelcomeMessageHandler,
  addToChannelFromWelcomeModal,
  addToChannelFromWelcomeModalHandler,
} from '../slack/add-to-channel-from-welcome';
import { privateChannelHandler } from '../slack/private-channel';
import { mentionedInThreadMessage } from '../slack/mentioned-in-thread.middleware';
import {
  channelJoinHandler,
  summarizeSuggestedChannelAfterJoin,
} from '../summaries/channel-join-handler';
import { channelSummaryFeedbackHandler } from '../summaries/channel/channel-summary-feedback';
import { channelSummaryPostHandler } from '../summaries/channel/channel-summary-post';
import { ChannelSummarizer } from '../summaries/channel/channel-summarizer';
import { mentionHandler } from '../summaries/mention-handler';
import { SummaryStore } from '../summaries/summary-store';
import { threadSummarizationHandler } from '../summaries/thread-handler';
import { threadSummaryFeedbackHandler } from '../summaries/thread/thread-summary-feedback';
import { threadSummaryPostHandler } from '../summaries/thread/thread-summary-post';
import { ThreadSummarizer } from '../summaries/thread/thread-summarizer';
import { slashCommandRouter } from './slash-command-router';
import {
  mentionedInThreadHandler,
  summarizeSuggestedThreadAfterMention,
} from '../summaries/mentioned-in-thread-handler';
import { NewUserTriggersManager } from '../new-user-triggers/manager';
import { userOnboardingMiddleware } from '../onboarding/global-middleware';
import { UserFeedbackManager } from '../user-feedback/manager';
import {
  handleStopNudge,
  handleUserFeedbackSubmit,
  handleUserTriggerFeedback,
  openFeedbackModalHandler,
} from '../user-feedback/handler';
import { channelSummaryMoreTimeHandler } from '../summaries/channel-summary-more-time';
import { SessionDataStore } from '../summaries/session-data/session-data-store';
import { IReporter } from '@base/metrics';
import { SlackBlockActionWrapper } from '../slack/types';
import { FeatureRateLimiter } from '../feature-rate-limiter/rate-limiter';
import {
  handleGistlyModalSubmit,
  openGistlyModal,
} from '../experimental/gistly/handler';
import { GistlyModel } from '../experimental/gistly/gistly.model';
import { MultiChannelSummarizer } from '../summaries/channel/multi-channel-summarizer';
import {
  summarySchedularSettingsButtonHandler,
  summarySchedularSettingsDisableHandler,
  summarySchedularSettingsDisableOpenModal,
  summarySchedularSettingsModalHandler,
} from '../summary-scheduler/handler';
import { SchedulerSettingsManager } from '../summary-scheduler/scheduler-manager';
import { botIMRouter } from './bot-im-router';
import { CustomerIdentifier } from '@base/customer-identifier';
import { OrgSettingsStore } from '../orgsettings/store';
import { orgSettingsMiddleware } from '../orgsettings/middleware';
import {
  mentionedInChannelHandler,
  summarizeSuggestedChannelAfterMention,
} from '../summaries/mentioned-in-channel-handler';
import { mentionedInChannelMessage } from '../slack/mentioned-in-channel.middleware';
import { SlackDataStore } from '../utils/slack-data-store';
import { ChatManager } from '../experimental/chat/manager';
import { ChatModel } from '../experimental/chat/chat.model';

export enum Routes {
  SUMMARIZE_THREAD = 'summarize-thread',
  ADD_TO_CHANNEL_SUBMIT = 'add-to-channel-submit',
  PRIVATE_CHANNEL_SUBMIT = 'private-channel-submit',
  THREAD_SUMMARY_FEEDBACK = 'thread-summary-feedback',
  THREAD_SUMMARY_POST = 'thread-summary-post',
  CHANNEL_SUMMARY_FEEDBACK = 'channel-summary-feedback',
  CHANNEL_SUMMARY_POST = 'channel-summary-post',
  ADD_TO_CHANNEL_FROM_WELCOME_MODAL = 'add-to-channel-from-welcome-modal',
  ADD_TO_CHANNEL_FROM_WELCOME_SUBMIT = 'add-to-channel-from-welcome-submit',
  ADD_TO_CHANNEL_FROM_WELCOME_MESSAGE = 'add-to-channel-from-welcome-message',
  TRIGGER_FEEDBACK = 'trigger-feedback',
  STOP_NUDGE_MESSAGES = 'stop-nudge-messages',
  SUMMARIZE_THREAD_FROM_THREAD_MENTION = 'summarize-thread-from-thread-mention',
  SUMMARIZE_CHANNEL_FROM_CHANNEL_MENTION = 'summarize-channel-from-channel-mention',
  SUMMARIZE_CHANNEL_FROM_CHANNEL_JOIN = 'summarize-channel-from-channel-join',
  SEND_USER_FEEDBACK = 'send-user-feedback',
  USER_FEEDBACK_MODAL_SUBMIT = 'user-feedback-modal-submit',
  SUMMARIZE_CHANNEL_MORE_TIME = 'summarize-channel-more-time',
  CLICKED_TO_OPEN_PRICING = 'click-to-open-pricing',
  GISTLY_MODAL = 'open-gistly-modal',
  GISTLY_MODAL_SUBMIT = 'gistly-modal-submit',
  OPEN_SCHEDULER_SETTINGS = 'open-scheduler-settings',
  SCHEDULER_SETTINGS_MODAL_SUBMIT = 'scheduler-settings-modal-submit',
  SCHEDULER_SETTINGS_DISABLE = 'scheduler-settings-disabled',
  SCHEDULER_SETTINGS_DISABLE_OPEN_MODAL = 'scheduler-settings-open-modal',
}

export const registerBoltAppRouter = (
  app: App,
  installationStore: InstallationStore,
  analyticsManager: AnalyticsManager,
  metricsReporter: IReporter,
  threadSummarizer: ThreadSummarizer,
  channelSummarizer: ChannelSummarizer,
  onboardingManager: OnboardingManager,
  summaryStore: SummaryStore,
  slackDataStore: SlackDataStore,
  newUserTriggersManager: NewUserTriggersManager,
  userFeedbackManager: UserFeedbackManager,
  sessionDataStore: SessionDataStore,
  featureRateLimiter: FeatureRateLimiter,
  multiChannelSummarizer: MultiChannelSummarizer,
  schedulerSettingsManager: SchedulerSettingsManager,
  customerIdentifier: CustomerIdentifier,
  orgSettingsStore: OrgSettingsStore,
) => {
  const onboardingMiddleware = userOnboardingMiddleware(onboardingManager);
  const setOrgSettingsMiddleware = orgSettingsMiddleware(orgSettingsStore);
  // The org settings middleware will run globally on every event, and attach org settings
  // to the context so that we can use them.
  app.use(setOrgSettingsMiddleware);

  app.shortcut(
    Routes.SUMMARIZE_THREAD,
    onboardingMiddleware,
    threadSummarizationHandler(analyticsManager, threadSummarizer),
  );

  const addToChannel = addToChannelHandler(
    analyticsManager,
    channelSummarizer,
    metricsReporter,
    threadSummarizer,
  );
  const privateChannel = privateChannelHandler(analyticsManager);

  const chatMessagesManager = new ChatManager(
    new ChatModel(),
    analyticsManager,
    slackDataStore,
  );

  app.view(Routes.ADD_TO_CHANNEL_SUBMIT, onboardingMiddleware, addToChannel);
  app.view(
    { callback_id: Routes.ADD_TO_CHANNEL_SUBMIT, type: 'view_closed' },
    onboardingMiddleware,
    addToChannel,
  );
  app.view(Routes.PRIVATE_CHANNEL_SUBMIT, onboardingMiddleware, privateChannel);
  app.view(
    { callback_id: Routes.PRIVATE_CHANNEL_SUBMIT, type: 'view_closed' },
    onboardingMiddleware,
    privateChannel,
  );
  app.command(
    /gist.*/,
    onboardingMiddleware,
    slashCommandRouter(
      channelSummarizer,
      analyticsManager,
      featureRateLimiter,
      schedulerSettingsManager,
      chatMessagesManager,
    ),
  );
  app.action(
    Routes.THREAD_SUMMARY_FEEDBACK,
    onboardingMiddleware,
    threadSummaryFeedbackHandler(
      analyticsManager,
      metricsReporter,
      userFeedbackManager,
      summaryStore,
      sessionDataStore,
    ),
  );

  app.action(
    Routes.THREAD_SUMMARY_POST,
    onboardingMiddleware,
    threadSummaryPostHandler(analyticsManager, metricsReporter, summaryStore),
  );

  app.action(
    Routes.CHANNEL_SUMMARY_FEEDBACK,
    onboardingMiddleware,
    channelSummaryFeedbackHandler(
      analyticsManager,
      userFeedbackManager,
      sessionDataStore,
      metricsReporter,
    ),
  );

  app.action(
    Routes.CHANNEL_SUMMARY_POST,
    onboardingMiddleware,
    channelSummaryPostHandler(analyticsManager, metricsReporter, summaryStore),
  );

  app.action(
    Routes.SUMMARIZE_CHANNEL_MORE_TIME,
    onboardingMiddleware,
    channelSummaryMoreTimeHandler(channelSummarizer),
  );

  app.view(
    Routes.ADD_TO_CHANNEL_FROM_WELCOME_SUBMIT,
    onboardingMiddleware,
    addToChannelFromWelcomeModal(analyticsManager, metricsReporter),
  );
  app.action(
    Routes.ADD_TO_CHANNEL_FROM_WELCOME_MODAL,
    onboardingMiddleware,
    addToChannelFromWelcomeModalHandler(analyticsManager, metricsReporter),
  );

  app.action(
    Routes.SUMMARIZE_THREAD_FROM_THREAD_MENTION,
    summarizeSuggestedThreadAfterMention(
      analyticsManager,
      metricsReporter,
      threadSummarizer,
      onboardingManager,
      schedulerSettingsManager,
    ),
  );
  app.action(
    Routes.SUMMARIZE_CHANNEL_FROM_CHANNEL_MENTION,
    summarizeSuggestedChannelAfterMention(
      analyticsManager,
      metricsReporter,
      channelSummarizer,
      onboardingManager,
      schedulerSettingsManager,
    ),
  );

  app.action(
    Routes.SUMMARIZE_CHANNEL_FROM_CHANNEL_JOIN,
    summarizeSuggestedChannelAfterJoin(
      analyticsManager,
      metricsReporter,
      channelSummarizer,
      onboardingManager,
      schedulerSettingsManager,
    ),
  );

  app.action(
    Routes.ADD_TO_CHANNEL_FROM_WELCOME_MESSAGE,
    onboardingMiddleware,
    addToChannelsFromWelcomeMessageHandler(
      analyticsManager,
      metricsReporter,
      channelSummarizer,
      schedulerSettingsManager,
      onboardingManager,
    ),
  );

  app.action(
    Routes.SEND_USER_FEEDBACK,
    onboardingMiddleware,
    openFeedbackModalHandler(analyticsManager),
  );
  app.action(
    Routes.TRIGGER_FEEDBACK,
    handleUserTriggerFeedback(analyticsManager, newUserTriggersManager),
  );
  app.action(
    Routes.STOP_NUDGE_MESSAGES,
    handleStopNudge(analyticsManager, onboardingManager),
  );

  app.view(
    Routes.USER_FEEDBACK_MODAL_SUBMIT,
    onboardingMiddleware,
    handleUserFeedbackSubmit(analyticsManager, userFeedbackManager),
  );
  app.view(
    { callback_id: Routes.USER_FEEDBACK_MODAL_SUBMIT, type: 'view_closed' },
    onboardingMiddleware,
    handleUserFeedbackSubmit(analyticsManager, userFeedbackManager),
  );

  app.shortcut(Routes.GISTLY_MODAL, onboardingMiddleware, openGistlyModal());

  const gistlyModel = new GistlyModel();
  app.view(
    Routes.GISTLY_MODAL_SUBMIT,
    onboardingMiddleware,
    handleGistlyModalSubmit(gistlyModel),
  );

  app.action(
    Routes.CLICKED_TO_OPEN_PRICING,
    async ({ ack, body }: SlackBlockActionWrapper) => {
      await ack();
      analyticsManager.buttonClicked({
        type: 'open_pricing',
        slackTeamId: body.team?.id || 'unknown',
        slackUserId: body.user.id,
      });
    },
  );

  app.action(
    Routes.OPEN_SCHEDULER_SETTINGS,
    summarySchedularSettingsButtonHandler(
      schedulerSettingsManager,
      analyticsManager,
    ),
  );

  app.view(
    Routes.SCHEDULER_SETTINGS_MODAL_SUBMIT,
    summarySchedularSettingsModalHandler(
      schedulerSettingsManager,
      analyticsManager,
      slackDataStore,
    ),
  );

  app.action(
    Routes.SCHEDULER_SETTINGS_DISABLE_OPEN_MODAL,
    summarySchedularSettingsDisableOpenModal(analyticsManager),
  );

  app.view(
    Routes.SCHEDULER_SETTINGS_DISABLE,
    summarySchedularSettingsDisableHandler(
      schedulerSettingsManager,
      analyticsManager,
    ),
  );

  app.message(
    botIMRouter(
      analyticsManager,
      onboardingManager,
      customerIdentifier,
      chatMessagesManager,
    ),
  );

  app.message(
    directMention(),
    mentionHandler(
      analyticsManager,
      metricsReporter,
      onboardingManager,
      chatMessagesManager,
    ),
  );

  app.message(
    mentionedInThreadMessage(),
    mentionedInThreadHandler(
      analyticsManager,
      metricsReporter,
      newUserTriggersManager,
    ),
  );
  app.message(
    mentionedInChannelMessage(),
    mentionedInChannelHandler(
      analyticsManager,
      metricsReporter,
      newUserTriggersManager,
      channelSummarizer,
    ),
  );

  const joinHandler = channelJoinHandler(
    analyticsManager,
    metricsReporter,
    channelSummarizer,
    onboardingManager,
    newUserTriggersManager,
    slackDataStore,
  );
  app.message(subtype('channel_join'), joinHandler);

  app.message(subtype('group_join'), joinHandler);

  app.event('app_uninstalled', async ({ body }) => {
    analyticsManager.installationFunnel({
      funnelStep: 'begin_uninstall',
      slackTeamId: body.team_id,
      slackUserId: 'unknown',
      extraParams: {
        isEnterprise: body.enterprise_id ? true : false,
      },
    });
    if (installationStore.deleteInstallation) {
      await installationStore.deleteInstallation({
        teamId: body.team_id,
        enterpriseId: body.enterprise_id,
        isEnterpriseInstall: body.enterprise_id ? true : false,
      });
    }
    analyticsManager.installationFunnel({
      funnelStep: 'successful_uninstall',
      slackTeamId: body.team_id,
      slackUserId: 'unknown',
      extraParams: {
        isEnterprise: body.enterprise_id ? true : false,
      },
    });
  });

  app.event(
    'app_home_opened',
    appHomeOpenedHandler(onboardingManager, analyticsManager),
  );

  // This is the global action handler, which will match all unmatched actions
  // The global action handler will wait 2500 milliseconds and then ack the received action.
  // The waiting and then acking is in order to avoid the Bolt Framework's error when you ack multiple
  // times on the same action.
  app.action(/.*/, async ({ ack, logger, body }) => {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    await delay(2500);

    try {
      await ack();
      logger.warn({ msg: `unacked action`, body: body });
    } catch (error) {
      // Do nothing on error, since the error is going to be the "ack multiple times error" and we don't care here
    }
  });

  // This is a general message event handler to log all received messages
  app.event('message', async ({ event, logger }) => {
    logger.info(event);
  });
};
