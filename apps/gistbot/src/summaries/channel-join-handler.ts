import { ChannelJoinMessageEvent } from '@slack/bolt';
import { ChatPostEphemeralResponse, WebClient } from '@slack/web-api';
import { AnalyticsManager } from '../analytics/manager';
import { NewUserTriggersManager } from '../new-user-triggers/manager';
import { OnboardingManager } from '../onboarding/manager';
import { Routes } from '../routes/router';
import { UserLink } from '../slack/components/user-link';
import { SlackBlockActionWrapper, SlackEventWrapper } from '../slack/types';
import { ChannelSummarizer } from './channel/channel-summarizer';
import { summaryInProgressMessage } from './utils';
import { TriggerContext } from './types';

const MINIMUM_MESSAGES_ON_CHANNEL_JOIN = 10;

interface AddedToChannelProps {
  channelId: string;
  triggerContext: TriggerContext;
}

export const channelJoinHandler =
  (
    analyticsManager: AnalyticsManager,
    channelSummarizer: ChannelSummarizer,
    onboardingManager: OnboardingManager,
    newUserTriggersManager: NewUserTriggersManager,
  ) =>
  async ({ client, logger, body, context }: SlackEventWrapper<'message'>) => {
    try {
      const { team_id } = body;
      const event = body.event as ChannelJoinMessageEvent;
      logger.info(`${event.user} has joined ${event.channel}`);

      const {
        error: infoError,
        ok: infoOk,
        user: userInfo,
      } = await client.users.info({
        user: event.user,
      });
      if (infoError || !infoOk) {
        throw new Error(
          `Failed to fetch user from slack when trying to summarize a channel ${infoError}`,
        );
      }

      if (!userInfo) {
        throw new Error(
          `Failed to fetch user from slack when trying to summarize a channel, user not found`,
        );
      }

      const rootMessages = await channelSummarizer.fetchChannelRootMessages(
        client,
        event.channel,
        context.botId || '',
        MINIMUM_MESSAGES_ON_CHANNEL_JOIN,
        7,
        userInfo.tz,
      );

      if (rootMessages.length < MINIMUM_MESSAGES_ON_CHANNEL_JOIN) {
        logger.info(
          `channel ${event.channel} has only ${rootMessages.length} messages in the last 7 days`,
        );
        return;
      }

      await sendUserSuggestion(
        event.channel,
        event.user,
        context.botUserId || '',
        team_id,
        analyticsManager,
        client,
        newUserTriggersManager,
      );
    } catch (error) {
      logger.error(
        `error in handling channel join summarization: ${error} ${error.stack}`,
      );
    }
  };

const sendUserSuggestion = async (
  channelId: string,
  userId: string,
  botUserId: string,
  teamId: string,
  analyticsManager: AnalyticsManager,
  client: WebClient,
  newUserTriggersManager: NewUserTriggersManager,
): Promise<ChatPostEphemeralResponse | null> => {
  const {
    error: presenceErr,
    ok: presenceOk,
    presence,
  } = await client.users.getPresence({ user: userId });
  if (presenceErr || !presenceOk) {
    throw new Error(`Failed to get presence ${presenceErr}`);
  }

  if (!presence) {
    throw new Error(`Failed to get presence not found`);
  }

  const props: AddedToChannelProps = {
    channelId: channelId,
    triggerContext: presence === 'away' ? 'in_dm' : 'in_channel',
  };

  const shouldTrigger =
    await newUserTriggersManager.shouldTriggerForPotentialUser(
      'channel_join',
      teamId,
      userId,
      presence,
    );

  if (!shouldTrigger) {
    return null;
  }

  const basicText = `Hi ${UserLink(userId)} I'm ${UserLink(
    botUserId,
  )}, I make life simpler by summarizing discussions on Slack.\n\nYou were just added to <#${channelId}>.\n\nWould you like a summary of the discussion so far?`;

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: basicText,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Summarize this channel',
            emoji: true,
          },
          style: 'primary',
          value: JSON.stringify(props),
          action_id: Routes.SUMMARIZE_CHANNEL_FROM_CHANNEL_JOIN,
        },
      ],
    },
  ];

  analyticsManager.messageSentToUserDM({
    type: 'suggest_channel_summary_for_channel',
    slackUserId: userId,
    slackTeamId: teamId,
    properties: {
      suggestedChannel: channelId,
      ephemeralInChannel: presence !== 'away',
    },
  });

  if (presence === 'away') {
    return client.chat.postMessage({
      channel: userId,
      text: basicText,
      blocks: blocks,
    });
  }

  return client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text: basicText,
    blocks: blocks,
  });
};

export const summarizeSuggestedChannelAfterJoin =
  (
    analyticsManager: AnalyticsManager,
    channelSummarizer: ChannelSummarizer,
    onboardingManager: OnboardingManager,
  ) =>
  async ({ ack, logger, body, client, context }: SlackBlockActionWrapper) => {
    try {
      await ack();

      const action = body.actions[0];
      if (action.type !== 'button') {
        throw new Error(
          'summarize channel after join received non-button action',
        );
      }

      const props = JSON.parse(action.value) as AddedToChannelProps;

      const { error, ok, channel } = await client.conversations.info({
        channel: props.channelId,
      });

      if (error || !ok) {
        throw new Error(`Failed to fetch conversation info ${error}`);
      }

      if (!channel || !channel.name) {
        throw new Error(
          `Failed to fetch conversation info conversation not found`,
        );
      }

      await summaryInProgressMessage(client, {
        channel: props.channelId,
        user: body.user.id,
        trigger_context: props.triggerContext,
      });

      await channelSummarizer.summarize(
        'channel_join',
        context.botId || '',
        body.team?.id || 'unknown',
        body.user.id,
        {
          type: 'channel',
          channelId: props.channelId,
          channelName: channel.name,
        },
        7,
        client,
      );

      if (props.triggerContext === 'in_dm') {
        await client.chat.postMessage({
          channel: body.user.id,
          text: `Great, your summary was created! Go and see your summary at <#${props.channelId}>`,
        });
      }

      // Trigger the onboarding at the end so that after they've clicked on the message the onboarding message will happen
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait for 10 seconds before triggering the onboarding message so we don't surprise the user before they see the previous message
      await onboardingManager.onboardUser(
        body.team?.id || 'unknown',
        body.user.id,
        client,
        'suggested_channel_summary',
        context.botUserId,
      );
    } catch (error) {
      logger.error(
        `error in summarize suggested channel after join: ${error} ${error.stack}`,
      );
    }
  };
