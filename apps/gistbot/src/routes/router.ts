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
import { channelJoinHandler } from '../summaries/channel-join-handler';
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
}

export const registerBoltAppRouter = (
  app: App,
  installationStore: InstallationStore,
  analyticsManager: AnalyticsManager,
  threadSummarizer: ThreadSummarizer,
  channelSummarizer: ChannelSummarizer,
  onboardingManager: OnboardingManager,
  summaryStore: SummaryStore,
) => {
  app.shortcut(
    Routes.SUMMARIZE_THREAD,
    threadSummarizationHandler(analyticsManager, threadSummarizer),
  );

  const addToChannel = addToChannelHandler(
    analyticsManager,
    channelSummarizer,
    threadSummarizer,
  );
  const privateChannel = privateChannelHandler(analyticsManager);

  app.view(Routes.ADD_TO_CHANNEL_SUBMIT, addToChannel);
  app.view(
    { callback_id: Routes.ADD_TO_CHANNEL_SUBMIT, type: 'view_closed' },
    addToChannel,
  );
  app.view(Routes.PRIVATE_CHANNEL_SUBMIT, privateChannel);
  app.view(
    { callback_id: Routes.PRIVATE_CHANNEL_SUBMIT, type: 'view_closed' },
    privateChannel,
  );
  app.command(
    /gist.*/,
    slashCommandRouter(channelSummarizer, analyticsManager),
  );
  app.action(
    Routes.THREAD_SUMMARY_FEEDBACK,
    threadSummaryFeedbackHandler(analyticsManager),
  );

  app.action(
    Routes.THREAD_SUMMARY_POST,
    threadSummaryPostHandler(analyticsManager, summaryStore),
  );

  app.action(
    Routes.CHANNEL_SUMMARY_FEEDBACK,
    channelSummaryFeedbackHandler(analyticsManager),
  );

  app.action(
    Routes.CHANNEL_SUMMARY_POST,
    channelSummaryPostHandler(analyticsManager, summaryStore),
  );

  app.view(
    Routes.ADD_TO_CHANNEL_FROM_WELCOME_SUBMIT,
    addToChannelFromWelcomeModal(analyticsManager),
  );
  app.action(
    Routes.ADD_TO_CHANNEL_FROM_WELCOME_MODAL,
    addToChannelFromWelcomeModalHandler(analyticsManager),
  );
  app.action(
    Routes.SUMMARIZE_THREAD_FROM_THREAD_MENTION,
    summarizeSuggestedThreadAfterMention(
      analyticsManager,
      threadSummarizer,
      onboardingManager,
    ),
  );

  app.action(
    Routes.ADD_TO_CHANNEL_FROM_WELCOME_MESSAGE,
    addToChannelFromWelcomeMessageHandler(analyticsManager, channelSummarizer),
  );

  app.message(async ({ event, say, body, context }) => {
    // We are only able to listen to our own IM channels, so if the message channel is an IM, then we can assume it's our own IM
    if (
      event.channel_type === 'im' &&
      'user' in event &&
      event.user !== 'USLACKBOT'
    ) {
      say({
        text: 'Hi there :wave:',
        blocks: Help(context.botUserId || ''),
      });
      console.log(event);
      analyticsManager.messageSentToUserDM({
        type: 'help_response_message',
        slackTeamId: body.team_id,
        slackUserId: event['user'] || 'unknown',
        properties: {
          triggerMessage: event['text'] || 'unknown text',
        },
      });
    }
  });

  app.message(
    directMention(),
    mentionHandler(
      analyticsManager,
      channelSummarizer,
      threadSummarizer,
      onboardingManager,
    ),
  );

  app.message(
    mentionedInThreadMessage(),
    mentionedInThreadHandler(analyticsManager),
  );

  app.message(
    subtype('channel_join'),
    channelJoinHandler(analyticsManager, channelSummarizer, onboardingManager),
  );

  app.message(
    subtype('group_join'),
    channelJoinHandler(analyticsManager, channelSummarizer, onboardingManager),
  );

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
  app.action(/.*/, onlyAck);

  // This is a general message event handler to log all received messages
  app.event('message', async ({ event, logger }) => {
    logger.info(event);
  });
};

const onlyAck = async ({ ack }) => {
  await ack();
};
