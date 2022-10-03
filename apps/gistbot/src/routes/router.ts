import { App, InstallationStore } from '@slack/bolt';
import { AnalyticsManager } from '../analytics/manager';
import { appHomeOpenedHandler } from '../onboarding/app-home-opened-handler';
import { OnboardingStore } from '../onboarding/onboardingStore';
import { addToChannelHandler } from '../slack/add-to-channel';
import {
  addToChannelFromWelcomeModal,
  addToChannelFromWelcomeModalHandler,
} from '../slack/add-to-channel-from-welcome';
import { Help } from '../slack/components/help';
import { privateChannelHandler } from '../slack/private-channel';
import { channelSummaryFeedbackHandler } from '../summaries/channel-summary-feedback';
import { ChannelSummaryModel } from '../summaries/models/channel-summary.model';
import { ThreadSummaryModel } from '../summaries/models/thread-summary.model';
import { threadSummarizationHandler } from '../summaries/thread-summarizer';
import { threadSummaryFeedbackHandler } from '../summaries/thread-summary-feedback';
import { slashCommandRouter } from './slash-command-router';

export enum Routes {
  SUMMARIZE_THREAD = 'summarize-thread',
  ADD_TO_CHANNEL_SUBMIT = 'add-to-channel-submit',
  PRIVATE_CHANNEL_SUBMIT = 'private-channel-submit',
  THREAD_SUMMARY_FEEDBACK = 'thread-summary-feedback',
  CHANNEL_SUMMARY_FEEDBACK = 'channel-summary-feedback',
  ADD_TO_CHANNEL_FROM_WELCOME_MODAL = 'add-to-channel-from-welcome-modal',
  ADD_TO_CHANNEL_FROM_WELCOME_SUBMIT = 'add-to-channel-from-welcome-submit',
}

export const registerBoltAppRouter = (
  app: App,
  installationStore: InstallationStore,
  analyticsManager: AnalyticsManager,
  threadSummaryModel: ThreadSummaryModel,
  channelSummaryModel: ChannelSummaryModel,
  onboardingStore: OnboardingStore,
) => {
  app.shortcut(
    Routes.SUMMARIZE_THREAD,
    threadSummarizationHandler(analyticsManager, threadSummaryModel),
  );

  const addToChannel = addToChannelHandler(analyticsManager);
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
    slashCommandRouter(channelSummaryModel, analyticsManager),
  );
  app.action(
    Routes.THREAD_SUMMARY_FEEDBACK,
    threadSummaryFeedbackHandler(analyticsManager),
  );
  app.action(
    Routes.CHANNEL_SUMMARY_FEEDBACK,
    channelSummaryFeedbackHandler(analyticsManager),
  );

  app.view(
    Routes.ADD_TO_CHANNEL_FROM_WELCOME_SUBMIT,
    addToChannelFromWelcomeModal(analyticsManager),
  );
  app.action(
    Routes.ADD_TO_CHANNEL_FROM_WELCOME_MODAL,
    addToChannelFromWelcomeModalHandler(analyticsManager),
  );

  app.message(async ({ event, say, body }) => {
    // We are only able to listen to our own IM channels, so if the message channel is an IM, then we can assume it's our own IM
    if (event.channel_type === 'im') {
      say({
        text: 'Hi there :wave:',
        blocks: Help(),
      });
      console.log(event);
      analyticsManager.messageSentToUserDM({
        type: 'help_response_message',
        slackTeamId: body.team_id,
        slackUserId: event['user'] || 'unknown',
        properties: {
          triggerMessage: event['text'],
        },
      });
    }
  });

  app.event('app_uninstalled', async ({ body }) => {
    if (installationStore.deleteInstallation) {
      await installationStore.deleteInstallation({
        teamId: body.team_id,
        enterpriseId: body.enterprise_id,
        isEnterpriseInstall: body.enterprise_id ? true : false,
      });
    }
  });

  app.event(
    'app_home_opened',
    appHomeOpenedHandler(onboardingStore, analyticsManager),
  );

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
