import { CustomerIdentifier } from '@base/customer-identifier';
import { AnalyticsManager } from '@base/gistbot-shared';
import { IReporter } from '@base/metrics';
import { App, directMention, InstallationStore, subtype } from '@slack/bolt';
import { EventEmitter } from 'events';
import {
  allSettingsButtonHandler,
  openGmailSettingsFromAllSettings,
  openSlackSettingsFromAllSettings,
} from '../all-settings/handler';
import { chatActionItemHandler } from '../chat/chat-action-items-handler';

import {
  emailReplyFromModalHandler,
  emailReplyHandler,
  emailReplySubmitHandler,
} from '../email-for-slack/action-handlers/email-reply';
import { emailOpenHandler } from '../email-for-slack/action-handlers/open-modal';
import {
  refreshActionHandler,
  refreshFromModalHandler,
} from '../email-for-slack/action-handlers/refresh-gmail';
import { saveDraft } from '../email-for-slack/action-handlers/save-draft';
import {
  emailSettingsBrokenLinkSubmitted,
  showEmailDigestBrokenLinksModal,
} from '../email-for-slack/email-digest-settings/email-digest-broken-link-modal-handler';
import {
  saveEmailDigestSettingsHandler,
  showEmailDigestSettingsModal,
} from '../email-for-slack/email-digest-settings/email-digest-settings-modal-handler';

import { ChatModel } from '../experimental/chat/chat.model';
import { ChatManager } from '../experimental/chat/manager';
import { GistlyModel } from '../experimental/gistly/gistly.model';
import {
  handleGistlyModalSubmit,
  openGistlyModal,
} from '../experimental/gistly/handler';
import { FeatureRateLimiter } from '../feature-rate-limiter/rate-limiter';
import { HomeDataStore } from '../home/home-data-store';
import { NewUserTriggersManager } from '../new-user-triggers/manager';
import { appHomeOpenedHandler } from '../onboarding/app-home-opened-handler';
import { userOnboardingMiddleware } from '../onboarding/global-middleware';
import { OnboardingManager } from '../onboarding/manager';
import { orgSettingsMiddleware } from '../orgsettings/middleware';
import { OrgSettingsStore } from '../orgsettings/store';
import { addToChannelHandler } from '../slack/add-to-channel';
import {
  addToChannelFromWelcomeModal,
  addToChannelFromWelcomeModalHandler,
  addToChannelsFromWelcomeMessageHandler,
} from '../slack/add-to-channel-from-welcome';
import { mentionedInChannelMessage } from '../slack/mentioned-in-channel.middleware';
import { mentionedInThreadMessage } from '../slack/mentioned-in-thread.middleware';
import { privateChannelHandler } from '../slack/private-channel';
import { SlackBlockActionWrapper } from '../slack/types';
import {
  channelJoinHandler,
  summarizeSuggestedChannelAfterJoin,
} from '../summaries/channel-join-handler';
import { channelSummaryMoreTimeHandler } from '../summaries/channel-summary-more-time';
import { ChannelSummarizer } from '../summaries/channel/channel-summarizer';
import { channelSummaryFeedbackHandler } from '../summaries/channel/channel-summary-feedback';
import { channelSummaryPostHandler } from '../summaries/channel/channel-summary-post';
import { MultiChannelSummarizer } from '../summaries/channel/multi-channel-summarizer';
import { mentionHandler } from '../summaries/mention-handler';
import {
  mentionedInChannelHandler,
  summarizeSuggestedChannelAfterMention,
} from '../summaries/mentioned-in-channel-handler';
import {
  mentionedInThreadHandler,
  summarizeSuggestedThreadAfterMention,
} from '../summaries/mentioned-in-thread-handler';
import { SessionDataStore } from '../summaries/session-data/session-data-store';
import { SummaryStore } from '../summaries/summary-store';
import { threadSummarizationHandler } from '../summaries/thread-handler';
import { ThreadSummarizer } from '../summaries/thread/thread-summarizer';
import { threadSummaryFeedbackHandler } from '../summaries/thread/thread-summary-feedback';
import { threadSummaryPostHandler } from '../summaries/thread/thread-summary-post';
import {
  summarySchedularSettingsButtonHandler,
  summarySchedularSettingsDisableHandler,
  summarySchedularSettingsModalHandler,
} from '../summary-scheduler/handler';
import { SchedulerSettingsManager } from '../summary-scheduler/scheduler-manager';
import { UninstallsNotifier } from '../uninstall/notifier';
import {
  handleStopNudge,
  handleUserFeedbackSubmit,
  handleUserTriggerFeedback,
  openFeedbackModalHandler,
} from '../user-feedback/handler';
import { UserFeedbackManager } from '../user-feedback/manager';
import { SlackDataStore } from '../utils/slack-data-store';
import { botIMRouter } from './bot-im-router';
import { slashCommandRouter } from './slash-command-router';
import { GmailSubscriptionsManager } from '../email-for-slack/gmail-subscription-manager/gmail-subscription-manager';
import {
  userEmailCalssifcation,
  userEmailChangeCategory,
} from '../email-for-slack/action-handlers/email-classification';
import { resolveMailViewHandler } from '../email-for-slack/view-handlers/resolve-mail-view-handler';
import { resolveMailActionHandler } from '../email-for-slack/action-handlers/resolve-mail-action-handler';

import {
  disconnectGmailHandler,
  disconnectGmailViewHandler,
} from '../email-for-slack/action-handlers/disconnect-gmail-handler';
import { ReplyOptionsHandler } from '../email-for-slack/action-handlers/reply-option';
import { dismissedOnBoarding } from '../email-for-slack/action-handlers/dismiss-onboarding';

const ARRAY_CHAT_GIST_ACTIONS = [0, 1, 2];

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
  CHAT_GIST_ONBOARDING_ACTION = 'chat-gist-action-item',
  STOP_NUDGE_MESSAGES = 'stop-nudge-messages',
  SUMMARIZE_THREAD_FROM_THREAD_MENTION = 'summarize-thread-from-thread-mention',
  SUMMARIZE_CHANNEL_FROM_CHANNEL_MENTION = 'summarize-channel-from-channel-mention',
  SUMMARIZE_CHANNEL_FROM_CHANNEL_JOIN = 'summarize-channel-from-channel-join',
  SEND_USER_FEEDBACK = 'send-user-feedback',
  USER_FEEDBACK_MODAL_SUBMIT = 'user-feedback-modal-submit',
  SUMMARIZE_CHANNEL_MORE_TIME = 'summarize-channel-more-time',
  CLICKED_TO_OPEN_PRICING = 'click-to-open-pricing',
  GISTLY_MODAL = 'open-gistly-modal',
  MAIL_REPLY = 'mail-reply-action',
  MAIL_REPLY_FROM_MODAL = 'mail-reply-from-modal',
  MAIL_REPLY_SUBMIT = 'mail-reply-submit',
  RESOLVE_MAIL = 'resolve-mail',
  RESOLVE_MAIL_FROM_VIEW = 'resolve-mail-view',
  MAIL_SAVE_DRAFT = 'save_draft',
  REFRESH_GMAIL = 'refresh-gmail',
  REFRESH_GMAIL_FROM_VIEW = 'refresh-gmail-from-modal',
  MAIL_RSVP = 'rsvp',
  MAIL_READ_MORE = 'mail-read-more',
  GISTLY_MODAL_SUBMIT = 'gistly-modal-submit',
  MAIL_ONBOARDING_DISMISSED = 'mail-onboarding-dismissed',
  OPEN_SCHEDULER_SETTINGS = 'open-scheduler-settings',
  OPEN_ALL_SETTINGS_MODAL = 'open-all-settings-modal',
  OPEN_EMAIL_SETTINGS_MODAL_FROM_ALL = 'open-email-settings-modal-from-all',
  OPEN_SLACK_SETTINGS_MODAL_FROM_ALL = 'open-slack-settings-modal-from-all',
  SCHEDULER_SETTINGS_MODAL_SUBMIT = 'scheduler-settings-modal-submit',
  SCHEDULER_SETTINGS_DISABLE = 'scheduler-settings-disabled',
  EMAIL_SETTINGS_MODAL_SUBMIT = 'email-settings-modal-submit',
  EMAIL_SETTINGS_OPEN_MODAL = 'email-settings-open-modal',
  EMAIL_LINK_BROKEN_OPEN_MODAL = 'email-link-broken-open-modal',
  EMAIL_LINK_BROKEN_MODAL_SUBMIT = 'email-link-broken-modal-submit',
  EMIL_CLASSIFICATION_ACTION = 'classification-action',
  EMAIL_CHANGE_CATEGORY = 'category-classification',
  EMAIL_SECTION_ACTION = 'email-section-action',
  DISCONNECT_GMAIL = 'disconnect-gmail',
  DISCONNECT_GMAIL_FROM_VIEW = 'disconnect-gmail-modal-submut',
  EMAIL_REPLY_OPTION = 'email_reply_option',
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
  gmailSubscriptionsManager: GmailSubscriptionsManager,
  newUserTriggersManager: NewUserTriggersManager,
  userFeedbackManager: UserFeedbackManager,
  sessionDataStore: SessionDataStore,
  featureRateLimiter: FeatureRateLimiter,
  multiChannelSummarizer: MultiChannelSummarizer,
  schedulerSettingsManager: SchedulerSettingsManager,
  customerIdentifier: CustomerIdentifier,
  orgSettingsStore: OrgSettingsStore,
  uninstallNotifier: UninstallsNotifier,
  eventEmitter: EventEmitter,
  homeDataStore: HomeDataStore,
) => {
  const chatModel = new ChatModel();
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
    chatModel,
    analyticsManager,
    slackDataStore,
    featureRateLimiter,
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
      multiChannelSummarizer,
      homeDataStore,
      eventEmitter,
    ),
  );
  app.action(Routes.MAIL_REPLY, emailReplyHandler(gmailSubscriptionsManager));
  app.view(
    Routes.EMAIL_CHANGE_CATEGORY,
    userEmailChangeCategory(analyticsManager, homeDataStore),
  );

  app.action(
    Routes.EMIL_CLASSIFICATION_ACTION,
    userEmailCalssifcation(analyticsManager, homeDataStore),
  );
  app.action(
    Routes.MAIL_READ_MORE,
    emailOpenHandler(homeDataStore, eventEmitter, analyticsManager),
  );

  app.action(
    Routes.RESOLVE_MAIL,
    resolveMailActionHandler(
      analyticsManager,
      eventEmitter,
      gmailSubscriptionsManager,
    ),
  );
  app.view(
    Routes.RESOLVE_MAIL_FROM_VIEW,
    resolveMailViewHandler(analyticsManager, eventEmitter),
  );

  app.action(
    Routes.MAIL_SAVE_DRAFT,
    saveDraft(analyticsManager, gmailSubscriptionsManager, eventEmitter),
  );

  app.action(
    Routes.REFRESH_GMAIL,
    refreshActionHandler(eventEmitter, analyticsManager),
  );

  app.view(
    Routes.REFRESH_GMAIL_FROM_VIEW,
    refreshFromModalHandler(eventEmitter),
  );

  app.view(
    Routes.MAIL_REPLY_SUBMIT,
    emailReplySubmitHandler(analyticsManager, eventEmitter),
  );
  app.action(
    Routes.MAIL_REPLY_FROM_MODAL,
    emailReplyFromModalHandler(analyticsManager, eventEmitter),
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

  app.action(Routes.EMAIL_REPLY_OPTION, ReplyOptionsHandler());

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
  ARRAY_CHAT_GIST_ACTIONS.forEach((val) =>
    app.action(
      `${Routes.CHAT_GIST_ONBOARDING_ACTION}-${val}`,
      chatActionItemHandler(analyticsManager, metricsReporter, chatModel),
    ),
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

  app.action(Routes.DISCONNECT_GMAIL, disconnectGmailHandler);
  app.action(
    Routes.MAIL_ONBOARDING_DISMISSED,
    dismissedOnBoarding(homeDataStore, analyticsManager, eventEmitter),
  );
  app.view(
    Routes.DISCONNECT_GMAIL_FROM_VIEW,
    disconnectGmailViewHandler(homeDataStore, analyticsManager),
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

  app.action(
    Routes.OPEN_ALL_SETTINGS_MODAL,
    allSettingsButtonHandler(homeDataStore, eventEmitter),
  );

  app.view(
    Routes.SCHEDULER_SETTINGS_MODAL_SUBMIT,
    summarySchedularSettingsModalHandler(
      schedulerSettingsManager,
      analyticsManager,
      slackDataStore,
      eventEmitter,
    ),
  );

  app.view(
    Routes.SCHEDULER_SETTINGS_DISABLE,
    summarySchedularSettingsDisableHandler(
      schedulerSettingsManager,
      analyticsManager,
    ),
  );

  app.view(
    Routes.EMAIL_SETTINGS_MODAL_SUBMIT,
    saveEmailDigestSettingsHandler(analyticsManager, slackDataStore),
  );

  app.action(
    Routes.EMAIL_SETTINGS_OPEN_MODAL,
    showEmailDigestSettingsModal(analyticsManager),
  );

  app.action(
    Routes.OPEN_EMAIL_SETTINGS_MODAL_FROM_ALL,
    openGmailSettingsFromAllSettings(analyticsManager),
  );

  app.action(
    Routes.OPEN_SLACK_SETTINGS_MODAL_FROM_ALL,
    openSlackSettingsFromAllSettings(
      analyticsManager,
      schedulerSettingsManager,
    ),
  );

  app.view(
    Routes.EMAIL_LINK_BROKEN_MODAL_SUBMIT,
    emailSettingsBrokenLinkSubmitted(analyticsManager),
  );

  app.action(
    Routes.EMAIL_LINK_BROKEN_OPEN_MODAL,
    showEmailDigestBrokenLinksModal(analyticsManager),
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
    const installation = await installationStore.fetchInstallation({
      teamId: body.team_id,
      enterpriseId: body.enterprise_id,
      isEnterpriseInstall: !!body.enterprise_id,
    });

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    uninstallNotifier.notify(body.team_id, installation);
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
    appHomeOpenedHandler(onboardingManager, analyticsManager, eventEmitter),
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
};
