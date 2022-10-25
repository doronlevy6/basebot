import { logger } from '@base/logger';
import { AnalyticsManager } from '../analytics/manager';
import { Routes } from '../routes/router';
import { addToChannel } from './add-to-channel';
import { SlackBlockActionWrapper, ViewAction } from './types';
import {
  ChannelSummarizer,
  DEFAULT_DAYS_BACK,
} from '../summaries/channel/channel-summarizer';
import { WebClient } from '@slack/web-api';
import { IReporter } from '@base/metrics';

const ADD_TO_CHANNEL_FROM_WELCOME = 'add-to-channel-from-welcome';
const ADD_TO_CHANNEL_FROM_WELCOME_MESSAGE =
  'add-to-channel-from-welcome-message';
const MESSAGE_THRESHOLD = 3;

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

export const addToChannelFromWelcomeMessageHandler =
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
      const selectedConversation = Object.values(body.state.values)[0][
        ADD_TO_CHANNEL_FROM_WELCOME_MESSAGE
      ].selected_conversation;
      logger.info(
        `${body.user.id} is adding the bot to channel ${selectedConversation}`,
      );
      if (!selectedConversation) {
        logger.error(`could not extract selected conversation`);
        return;
      }
      analyticsManager.welcomeMessageInteraction({
        type: 'channel_selected',
        slackUserId: body.user.id,
        slackTeamId: body.user.team_id || 'unknown',
        properties: {
          channelId: selectedConversation,
        },
      });
      await onBoardingSummarizeLoadingMessage(client, body.user.id);
      analyticsManager.messageSentToUserDM({
        type: 'onboarding_channel_loading',
        slackTeamId: body.team?.id || 'unknown',
        slackUserId: body.user.id || 'unknown',
      });
      await addToChannel(
        client,
        {
          currentUser: body.user.id,
          channelId: selectedConversation,
          teamId: body.user.team_id || 'unknown',
        },
        analyticsManager,
      );
      analyticsManager.welcomeMessageInteraction({
        type: 'channel_joined',
        slackUserId: body.user.id,
        slackTeamId: body.user.team_id || 'unknown',
        properties: {
          channelId: selectedConversation,
        },
      });
      try {
        const { messages } = await client.conversations.history({
          channel: selectedConversation,
        });

        if (!messages || messages.length < MESSAGE_THRESHOLD) {
          analyticsManager.welcomeMessageInteraction({
            type: 'channel_too_few',
            slackUserId: body.user.id,
            slackTeamId: body.user.team_id || 'unknown',
            properties: {
              channelId: selectedConversation,
            },
          });
          await onBoardingChannelNotReadyMessage(client, body.user.id);
          analyticsManager.messageSentToUserDM({
            type: 'onboarding_channel_too_few',
            slackTeamId: body.team?.id || 'unknown',
            slackUserId: body.user.id || 'unknown',
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
          'add_to_channel',
          context.botId || '',
          body.team?.id || 'unknown',
          body.user.id,
          {
            type: 'channel',
            channelId: selectedConversation,
            channelName: res.channel?.name || '',
          },
          DEFAULT_DAYS_BACK,
          client,
        );
        analyticsManager.welcomeMessageInteraction({
          type: 'channel_summarized',
          slackUserId: body.user.id,
          slackTeamId: body.user.team_id || 'unknown',
          properties: {
            channelId: selectedConversation,
          },
        });
        await onBoardingChannelSummarizeSuccessMessage(
          client,
          selectedConversation,
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

async function onBoardingSummarizeLoadingMessage(
  client: WebClient,
  userId: string,
) {
  const text = 'Awesome! Getting that summary ready for you! 🦾';
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
) {
  await client.chat.postMessage({
    channel: userId,
    text: `It seems like the channel does not have enough messages for me to summarize, can you try a different one?`,
  });
}

async function onBoardingChannelSummarizeSuccessMessage(
  client: WebClient,
  selectedConversation: string,
  userId: string,
) {
  const text = `Done! Let's go see it at <#${selectedConversation}> 👀.`;
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
    text: 'Add me to more channels',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Add me to more channels',
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Select a channel...',
            emoji: true,
          },
          action_id: Routes.ADD_TO_CHANNEL_FROM_WELCOME_MODAL,
        },
      },
    ],
  });
}
