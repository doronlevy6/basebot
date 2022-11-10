import { logger } from '@base/logger';
import { AnalyticsManager } from '../analytics/manager';
import { Routes } from '../routes/router';
import { addToChannel } from './add-to-channel';
import { SlackBlockActionWrapper, ViewAction } from './types';
import { ChannelSummarizer } from '../summaries/channel/channel-summarizer';
import { WebClient } from '@slack/web-api';
import { IReporter } from '@base/metrics';
import { SchedulerSettingsOnboardingButton } from './components/scheduler-settings-onboarding-button';

const ADD_TO_CHANNEL_FROM_WELCOME = 'add-to-channel-from-welcome';
const ADD_TO_CHANNEL_FROM_WELCOME_MESSAGE =
  'add-to-channel-from-welcome-message';
const MESSAGE_THRESHOLD = 3;
const DAYS_BACK_FOR_ONBOARDING = 3;

export const addToChannelFromWelcomeModal =
  (analyticsManager: AnalyticsManager, metricsReporter: IReporter) =>
  async (params: ViewAction) => {
    const { ack, body, client, view } = params;

    try {
      await ack();

      const submitted = body.type === 'view_submission';
      const props = JSON.parse(view.private_metadata) as ChannelModalProps;

      analyticsManager.modalClosed({
        type: 'add_to_channels_from_welcome',
        slackUserId: body.user.id,
        slackTeamId: body.user.team_id || 'unknown',
        submitted: submitted,
      });

      if (!submitted) {
        return;
      }

      const selectedConversations =
        Object.values(body.view.state.values)[0][ADD_TO_CHANNEL_FROM_WELCOME]
          .selected_conversations || [];

      logger.info(
        `${body.user.id} is adding the bot to channels ${selectedConversations}`,
      );

      await Promise.all(
        selectedConversations.map((c) =>
          addToChannel(
            client,
            {
              currentUser: body.user.id,
              channelId: c,
              teamId: body.user.team_id || 'unknown',
            },
            analyticsManager,
          ),
        ),
      );

      await client.chat.postEphemeral({
        user: body.user.id,
        channel: props.originChannel || props.user,
        thread_ts: props.threadTs,
        text: 'theGist was added to the selected channels!:rocket:',
      });
    } catch (err) {
      metricsReporter.error(
        'add to channel from welcome',
        'add-to-channel-from-welcome-modal',
      );
      logger.error(`Add to channel from welcome modal error: ${err.stack}`);
    }
  };

interface ChannelModalProps {
  originChannel?: string;
  threadTs?: string;
  user: string;
}

export const addToChannelFromWelcomeModalHandler =
  (analyticsManager: AnalyticsManager, metricsReporter: IReporter) =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    try {
      await ack();

      const props: ChannelModalProps = {
        originChannel: body.channel?.id,
        threadTs: body.message?.thread_ts,
        user: body.user.id,
      };

      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: Routes.ADD_TO_CHANNEL_FROM_WELCOME_SUBMIT,
          private_metadata: JSON.stringify(props),
          submit: {
            type: 'plain_text',
            text: 'Add me to these channels',
            emoji: true,
          },
          close: {
            type: 'plain_text',
            text: 'Close',
            emoji: true,
          },
          title: {
            type: 'plain_text',
            text: `Add theGist to channels`,
            emoji: true,
          },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Select channels to add me to:',
              },
              accessory: {
                type: 'multi_conversations_select',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select a channel...',
                  emoji: true,
                },
                filter: {
                  include: ['public'],
                  exclude_bot_users: true,
                  exclude_external_shared_channels: true,
                },
                action_id: ADD_TO_CHANNEL_FROM_WELCOME,
              },
            },
          ],
        },
      });

      analyticsManager.modalView({
        type: 'add_to_channels_from_welcome',
        slackUserId: body.user.id,
        slackTeamId: body.user.team_id || 'unknown',
      });
    } catch (error) {
      metricsReporter.error(
        'add to channel from welcome modal submit',
        'add-to-channel-from-welcome-modal-handler',
      );
      logger.error(`error in add to channel from welcome: ${error.stack}`);
    }
  };

export const addToChannelsFromWelcomeMessageHandler =
  (
    analyticsManager: AnalyticsManager,
    metricsReporter: IReporter,
    channelSummarizer: ChannelSummarizer,
  ) =>
  async ({ ack, logger, body, client, context }: SlackBlockActionWrapper) => {
    try {
      await ack();
      if (!body.state?.values) {
        logger.error(`no content for user action found`);
        return;
      }
      const selectedConversations = Object.values(body.state.values)[0][
        ADD_TO_CHANNEL_FROM_WELCOME_MESSAGE
      ].selected_conversations;
      logger.info(
        `${body.user.id} is adding the bot to channel ${selectedConversations}`,
      );
      if (!selectedConversations?.length) {
        logger.error(`could not extract selected conversation`);
        return;
      }
      analyticsManager.welcomeMessageInteraction({
        type: 'channels_selected',
        slackUserId: body.user.id,
        slackTeamId: body.user.team_id || 'unknown',
        properties: {
          channelIds: selectedConversations,
        },
      });
      await onBoardingSummarizeLoadingMessage(
        client,
        body.user.id,
        selectedConversations,
      );
      analyticsManager.messageSentToUserDM({
        type: 'onboarding_channel_loading',
        slackTeamId: body.team?.id || 'unknown',
        slackUserId: body.user.id || 'unknown',
      });
      const joinChannelsPromises = selectedConversations.map((channel) => {
        return addToChannel(
          client,
          {
            currentUser: body.user.id,
            channelId: channel,
            teamId: body.user.team_id || 'unknown',
          },
          analyticsManager,
        );
      });
      await Promise.allSettled(joinChannelsPromises);

      analyticsManager.welcomeMessageInteraction({
        type: 'channels_joined',
        slackUserId: body.user.id,
        slackTeamId: body.user.team_id || 'unknown',
        properties: {
          channelIds: selectedConversations,
        },
      });
      try {
        const onBoardChannelsPromises = selectedConversations.map((channel) => {
          return onBoardAddToAChannel(
            analyticsManager,
            channelSummarizer,
            client,
            channel,
            body.user.id,
            body.user.team_id || 'unknown',
            context.botId,
          );
        });

        const channelErrs = await Promise.all(onBoardChannelsPromises);
        if (channelErrs?.length) {
          const channelErrsIds: string[] = channelErrs.filter(
            (c) => c != undefined,
          ) as string[];
          await onBoardingChannelNotReadyMessage(
            client,
            body.user.id,
            selectedConversations,
            channelErrsIds,
          );
        }

        await onBoardingChannelSummarizeSuccessMessage(
          client,
          selectedConversations,
          body.user.id,
        );
        analyticsManager.messageSentToUserDM({
          type: 'onboarding_summary_success',
          slackTeamId: body.team?.id || 'unknown',
          slackUserId: body.user.id || 'unknown',
        });

        await onBoardingAddToMoreChannels(client, body.user.id);
        analyticsManager.messageSentToUserDM({
          type: 'onboarding_add_to_more_channels',
          slackTeamId: body.team?.id || 'unknown',
          slackUserId: body.user.id,
        });

        postOnBoardingSchedulerSettingsBtn(client, body.user.id);
      } catch (error) {
        metricsReporter.error(
          'add to channel from welcome message',
          'add-to-channel-from-welcome-message-handler',
        );
        logger.error(`error in fetching channel message count: ${error.stack}`);
      }
    } catch (error) {
      logger.error(`error in add to channel from welcome: ${error.stack}`);
    }
  };

async function onBoardAddToAChannel(
  analyticsManager: AnalyticsManager,
  channelSummarizer: ChannelSummarizer,
  client: WebClient,
  selectedConversation: string,
  userId: string,
  teamId: string,
  botId?: string,
) {
  const rootMessages = await channelSummarizer.fetchChannelRootMessages(
    client,
    selectedConversation,
    botId || '',
    MESSAGE_THRESHOLD,
    DAYS_BACK_FOR_ONBOARDING,
  );

  let errChannelId = '';
  if (!rootMessages || rootMessages.length < MESSAGE_THRESHOLD) {
    errChannelId = selectedConversation;
    analyticsManager.welcomeMessageInteraction({
      type: 'channel_too_few',
      slackUserId: userId,
      slackTeamId: teamId || 'unknown',
      properties: {
        channelId: selectedConversation,
      },
    });
    analyticsManager.messageSentToUserDM({
      type: 'onboarding_channel_too_few',
      slackTeamId: teamId || 'unknown',
      slackUserId: userId || 'unknown',
    });
    logger.info(
      `bot was added to a channel with ${MESSAGE_THRESHOLD} or less messages: channel id: ${selectedConversation}`,
    );
    return;
  }

  const res = await client.conversations.info({
    channel: selectedConversation,
  });
  await channelSummarizer.summarize(
    'onboarding',
    botId || '',
    teamId || 'unknown',
    userId,
    {
      type: 'channel',
      channelId: selectedConversation,
      channelName: res.channel?.name || '',
    },
    DAYS_BACK_FOR_ONBOARDING,
    client,
  );
  analyticsManager.welcomeMessageInteraction({
    type: 'channel_summarized',
    slackUserId: userId,
    slackTeamId: teamId || 'unknown',
    properties: {
      channelId: selectedConversation,
    },
  });

  return errChannelId;
}
async function onBoardingSummarizeLoadingMessage(
  client: WebClient,
  userId: string,
  channels: string[],
) {
  const summarySingularOrPlural =
    channels.length === 1 ? 'summary' : 'summaries';
  const text = `Awesome! Getting that ${summarySingularOrPlural} ready for you! 🦾`;
  await client.chat.postMessage({
    channel: userId,
    text: text,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: text,
        },
      },
    ],
  });
}

async function onBoardingChannelNotReadyMessage(
  client: WebClient,
  userId: string,
  channelIds: string[],
  channelErrs: string[],
) {
  let text = '';
  if (channelIds.length === channelErrs.length) {
    text = `It seems like the chosen channels does not have enough messages for me to summarize, do you want to choose different ones?`;
  } else {
    const channelErrsLinks = channelIds.map((c) => `<#${c}> `);
    const channelSingularOrPlural =
      channelErrs.length === 1 ? 'channel' : 'channels';
    text = `It seems like the ${channelSingularOrPlural} ${channelErrsLinks}  does not have enough messages for me to summarize, do you want to choose another one?`;
  }
  await client.chat.postMessage({
    channel: userId,
    text,
  });
}

async function onBoardingChannelSummarizeSuccessMessage(
  client: WebClient,
  selectedConversations: string[],
  userId: string,
) {
  const channelsLinks = selectedConversations.map((c) => `<#${c}> `);
  const text = `Done! Let's go see them at ${channelsLinks.join('')} 👀.`;
  await client.chat.postMessage({
    channel: userId,
    text: text,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: text,
        },
      },
    ],
  });
}

async function onBoardingAddToMoreChannels(client: WebClient, userId: string) {
  await client.chat.postMessage({
    channel: userId,
    text: 'When you’re back, you can add me to more channels here ➡️',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'When you’re back, you can add me to more channels here ➡️',
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Select channels',
            emoji: true,
          },
          action_id: Routes.ADD_TO_CHANNEL_FROM_WELCOME_MODAL,
        },
      },
    ],
  });
}

function postOnBoardingSchedulerSettingsBtn(client: WebClient, userId: string) {
  setTimeout(async () => {
    await client.chat.postMessage({
      channel: userId,
      blocks: SchedulerSettingsOnboardingButton(),
    });
  }, 5000);
}
