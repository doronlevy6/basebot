import { logger } from '@base/logger';
import { AnalyticsManager } from '@base/gistbot-shared';
import { Routes } from '../routes/router';
import { addToChannel } from './add-to-channel';
import { SlackBlockActionWrapper, ViewAction } from './types';
import { ChannelSummarizer } from '../summaries/channel/channel-summarizer';
import { WebClient } from '@slack/web-api';
import { IReporter } from '@base/metrics';
import { SchedulerSettingsOnboardingButton } from './components/scheduler-settings-onboarding-button';
import { onboardingChannelSummarizeMessage } from './components/onboarding-channel-summarize-message';
import { SchedulerSettingsManager } from '../summary-scheduler/scheduler-manager';
import {
  UserSchedulerOptions,
  UserSchedulerSettings,
} from '../summary-scheduler/types';

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
    schedulerManager: SchedulerSettingsManager,
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

        let channelErrs = await Promise.all(onBoardChannelsPromises);
        if (channelErrs?.length) {
          channelErrs = channelErrs.filter(
            (c) => c != undefined && c != '',
          ) as string[];
        }

        const successChannels = selectedConversations.filter(
          (c) => !channelErrs.includes(c),
        );
        await postOnboardingChannelSummarizeMessage(
          client,
          successChannels,
          channelErrs,
          selectedConversations,
          body.user.id,
        );
        analyticsManager.messageSentToUserDM({
          type: 'onboarding_summary_success',
          slackTeamId: body.team?.id || 'unknown',
          slackUserId: body.user.id || 'unknown',
        });

        // send more options to user only if not all the channels summaries failed
        if (selectedConversations?.length !== channelErrs?.length) {
          await onBoardingAddToMoreChannels(client, body.user.id);
          analyticsManager.messageSentToUserDM({
            type: 'onboarding_add_to_more_channels',
            slackTeamId: body.team?.id || 'unknown',
            slackUserId: body.user.id,
          });

          postOnBoardingSchedulerSettingsBtn(client, body.user.id);
        }

        await saveDefaultUserSchedulerSettings(
          client,
          schedulerManager,
          body.user.id,
          body.team?.id || 'unknown',
          selectedConversations,
        );
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

  if (!rootMessages || rootMessages.length < MESSAGE_THRESHOLD) {
    const errChannelId = selectedConversation;
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
    return errChannelId;
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

  return '';
}
async function onBoardingSummarizeLoadingMessage(
  client: WebClient,
  userId: string,
  channels: string[],
) {
  const summarySingularOrPlural =
    channels.length === 1 ? 'that summary' : 'those summaries';
  const text = `Awesome! Getting ${summarySingularOrPlural} ready for you! 🦾`;
  await client.chat.postMessage({
    channel: userId,
    text: text,
    blocks: [
      {
        type: 'divider',
      },
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

async function postOnboardingChannelSummarizeMessage(
  client: WebClient,
  succesChannelsIds: string[],
  errorChannelsIds: string[],
  allChannelsIds: string[],
  userId: string,
) {
  await client.chat.postMessage({
    channel: userId,
    blocks: onboardingChannelSummarizeMessage(
      succesChannelsIds,
      errorChannelsIds,
      allChannelsIds,
      DAYS_BACK_FOR_ONBOARDING,
    ),
  });
}

async function onBoardingAddToMoreChannels(client: WebClient, userId: string) {
  await client.chat.postMessage({
    channel: userId,
    text: '*Add more channels:*',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Add more channels:*',
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
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  setTimeout(async () => {
    await client.chat.postMessage({
      channel: userId,
      blocks: SchedulerSettingsOnboardingButton(),
    });
  }, 5000);
}

async function saveDefaultUserSchedulerSettings(
  client: WebClient,
  schedulerMgr: SchedulerSettingsManager,
  userId: string,
  teamId: string,
  selectedChannels: string[],
) {
  const userInfo = await client.users.info({ user: userId });
  if (
    !userInfo ||
    !userInfo.ok ||
    userInfo.error ||
    !userInfo.user?.tz_offset
  ) {
    logger.error(
      `could not fetch user: ${userId} info to get timezone in user onboarding`,
    );
    return;
  }

  // set default hour
  const date = new Date();
  date.setUTCHours(Number(UserSchedulerOptions.MORNING), 0, 0);
  const defaultHour =
    date.getUTCHours() - Math.floor(userInfo.user.tz_offset / 3600);

  const usersettings = new UserSchedulerSettings();
  usersettings.slackUser = userId;
  usersettings.slackTeam = teamId;
  usersettings.enabled = true;
  usersettings.timeHour = defaultHour;
  usersettings.selectedHour = Number(UserSchedulerOptions.MORNING);

  const channelsInfos = await Promise.all(
    selectedChannels.map((c) => {
      return client.conversations.info({ channel: c });
    }),
  );

  for (const channelInfo of channelsInfos) {
    if (
      !channelInfo.ok ||
      channelInfo.error ||
      !channelInfo.channel?.id ||
      !channelInfo.channel?.name
    ) {
      logger.error(
        `error fetching channel info when saving default user settings in user onboarding`,
      );
      return;
    }
  }

  usersettings.channels = channelsInfos.map((channelInfo) => {
    return {
      channelId: channelInfo.channel?.id as string,
      channelName: channelInfo.channel?.name as string,
    };
  });
  usersettings.days = [0, 1, 2, 3, 4, 5, 6];
  await schedulerMgr.saveUserSchedulerSettings(usersettings);
}
