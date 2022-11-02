import { App, directMention, InstallationStore, subtype } from '@slack/bolt';
import { AnalyticsManager } from '../analytics/manager';
import { appHomeOpenedHandler } from '../onboarding/app-home-opened-handler';
import { OnboardingManager } from '../onboarding/manager';
import { addToChannelHandler } from '../slack/add-to-channel';
import {
  addToChannelFromWelcomeMessageHandler,
  addToChannelFromWelcomeModal,
  addToChannelFromWelcomeModalHandler,
} from '../slack/add-to-channel-from-welcome';
import { Help } from '../slack/components/help';
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
  handleUserFeedbackSubmit,
  openFeedbackModalHandler,
} from '../user-feedback/handler';
import { isBaseTeamWorkspace } from '../slack/utils';
import { channelSummaryMoreTimeHandler } from '../summaries/channel-summary-more-time';
import { SessionDataStore } from '../summaries/session-data/session-data-store';
import { IReporter } from '@base/metrics';
import { SlackBlockActionWrapper } from '../slack/types';
import { FeatureRateLimiter } from '../feature-rate-limiter/rate-limiter';
import { handleGistlyModalSubmit, openGistlyModal } from '../gistly/handler';
import { GistlyModel } from '../gistly/gistly.model';

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
  SUMMARIZE_THREAD_FROM_THREAD_MENTION = 'summarize-thread-from-thread-mention',
  SUMMARIZE_CHANNEL_FROM_CHANNEL_JOIN = 'summarize-channel-from-channel-join',
  SEND_USER_FEEDBACK = 'send-user-feedback',
  USER_FEEDBACK_MODAL_SUBMIT = 'user-feedback-modal-submit',
  SUMMARIZE_CHANNEL_MORE_TIME = 'summarize-channel-more-time',
  CLICKED_TO_OPEN_PRICING = 'click-to-open-pricing',
  GISTLY_MODAL = 'open-gistly-modal',
  GISTLY_MODAL_SUBMIT = 'gistly-modal-submit',
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
  newUserTriggersManager: NewUserTriggersManager,
  userFeedbackManager: UserFeedbackManager,
  sessionDataStore: SessionDataStore,
  featureRateLimiter: FeatureRateLimiter,
) => {
  const onboardingMiddleware = userOnboardingMiddleware(onboardingManager);

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
    slashCommandRouter(channelSummarizer, analyticsManager, featureRateLimiter),
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
    ),
  );

  app.action(
    Routes.SUMMARIZE_CHANNEL_FROM_CHANNEL_JOIN,
    summarizeSuggestedChannelAfterJoin(
      analyticsManager,
      metricsReporter,
      channelSummarizer,
      onboardingManager,
    ),
  );

  app.action(
    Routes.ADD_TO_CHANNEL_FROM_WELCOME_MESSAGE,
    onboardingMiddleware,
    addToChannelFromWelcomeMessageHandler(
      analyticsManager,
      metricsReporter,
      channelSummarizer,
    ),
  );

  app.action(
    Routes.SEND_USER_FEEDBACK,
    onboardingMiddleware,
    openFeedbackModalHandler(analyticsManager),
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

  app.message(async ({ event, say, body, context, logger, client }) => {
    if (event.channel_type === 'im' && 'bot_profile' in event) {
      logger.warn({ msg: `a bot is talking to us`, bot: event.bot_profile });
      return;
    }

    logger.debug({ msg: `im to the bot`, event: event });

    if (isBaseTeamWorkspace(body.team_id)) {
      return;
    }

    // We are only able to listen to our own IM channels, so if the message channel is an IM, then we can assume it's our own IM
    if (
      event.channel_type !== 'im' ||
      ('user' in event && event.user === 'USLACKBOT')
    ) {
      return;
    }
    if (!('user' in event) || !event.user) {
      logger.warn({ msg: `im without user`, event: event });
      return;
    }

    // If the user hasn't been onboarded yet then we only want to trigger the onboarding
    const wasOnboarded = await onboardingManager.wasUserOnboarded(
      body.team_id,
      event.user,
    );
    if (!wasOnboarded) {
      await onboardingManager.onboardUser(
        body.team_id,
        event.user,
        client,
        'app_home_opened',
      );
      return;
    }

    say({
      text: 'Hi there :wave:',
      blocks: Help(event.user, context.botUserId || ''),
    });

    analyticsManager.messageSentToUserDM({
      type: 'help_response_message',
      slackTeamId: body.team_id,
      slackUserId: event['user'],
      properties: {
        triggerMessage: event['text'] || 'unknown text',
      },
    });
  });

  app.message(
    directMention(),
    mentionHandler(
      analyticsManager,
      metricsReporter,
      channelSummarizer,
      threadSummarizer,
      onboardingManager,
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

  const joinHandler = channelJoinHandler(
    analyticsManager,
    metricsReporter,
    channelSummarizer,
    onboardingManager,
    newUserTriggersManager,
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

  app.event('app_home_opened', appHomeOpenedHandler(onboardingManager));

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
