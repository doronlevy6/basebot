import { GenericMessageEvent } from '@slack/bolt';
import { ChatPostEphemeralResponse, WebClient } from '@slack/web-api';
import { AnalyticsManager } from '@base/gistbot-shared';
import { NewUserTriggersManager } from '../new-user-triggers/manager';
import { OnboardingManager } from '../onboarding/manager';
import { SlackBlockActionWrapper, SlackEventWrapper } from '../slack/types';
import { summaryInProgressMessage } from './utils';
import { TriggerContext } from './types';
import { IReporter } from '@base/metrics';
import { getOrgSettingsFromContext } from '../orgsettings/middleware';
import { getChannelMentionedUsersFromContext } from '../slack/mentioned-in-channel.middleware';
import { ChannelSummarizer } from './channel/channel-summarizer';
import { logger } from '@base/logger';
import {
  MentionedInChannel,
  MentionedInChannelText,
} from '../slack/components/mentioned-in-channel';

const CHANNEL_LENGTH_LIMIT = 10;

export interface MentionedInChannelProps {
  channelId: string;
  triggerContext: TriggerContext;
}

export const mentionedInChannelHandler =
  (
    analyticsManager: AnalyticsManager,
    metricsReporter: IReporter,
    newUserTriggersManager: NewUserTriggersManager,
  ) =>
  async ({ client, logger, body, context }: SlackEventWrapper<'message'>) => {
    try {
      const event = body.event as GenericMessageEvent;

      const channelMentionedUsers = new Set(
        getChannelMentionedUsersFromContext(context),
      );
      if (channelMentionedUsers.size === 0) {
        logger.warn(
          `received no channel mentioned users in mentioned in channel handler`,
        );
        return;
      }

      // If the org settings are undefined (not able to be found on the event for some reason)
      // or the triggers are not enabled, we drop the event.
      const orgSettings = getOrgSettingsFromContext(context);
      if (!orgSettings || !orgSettings.newUserTriggersEnabled) {
        logger.info({
          msg: 'triggers are disabled on the organization, skipping mentioned in channel event',
          event: body,
          orgSettings: orgSettings,
        });
        return;
      }

      const { messages } = await client.conversations.history({
        channel: event.channel,
        latest: event.ts,
        limit: CHANNEL_LENGTH_LIMIT,
      });

      if (!messages) {
        throw new Error(`Failed to fetch replies not found`);
      }

      if (messages.length < CHANNEL_LENGTH_LIMIT) {
        logger.debug(
          `channel ${event.channel} has less than ${CHANNEL_LENGTH_LIMIT} messages`,
        );
        return;
      }

      messages.forEach((m) => {
        if (m.user && channelMentionedUsers.has(m.user)) {
          channelMentionedUsers.delete(m.user);
        }
      });

      if (channelMentionedUsers.size === 0) {
        logger.info(
          `all mentioned users were active within the last ${CHANNEL_LENGTH_LIMIT} messages on ${event.channel}`,
        );
        return;
      }

      const awaits: Promise<ChatPostEphemeralResponse | null>[] = [];
      for (const user of channelMentionedUsers) {
        awaits.push(
          sendUserSuggestion(
            event.channel,
            user,
            context.botUserId || '',
            body.team_id,
            analyticsManager,
            client,
            newUserTriggersManager,
          ),
        );
      }

      await Promise.all(awaits);
    } catch (error) {
      metricsReporter.error(
        'mentioned in channel',
        'mentioned-in-channel-handler',
      );
      logger.error(
        `error in handling channel mentioned users: ${error} ${error.stack}`,
      );
    }
  };

export const summarizeSuggestedChannelAfterMention =
  (
    analyticsManager: AnalyticsManager,
    metricsReporter: IReporter,
    channelSummarizer: ChannelSummarizer,
    onboardingManager: OnboardingManager,
  ) =>
  async ({ ack, logger, body, client, context }: SlackBlockActionWrapper) => {
    try {
      await ack();

      const action = body.actions[0];
      if (action.type !== 'button') {
        throw new Error(
          'summarize channel after mention received non-button action',
        );
      }

      const props = JSON.parse(action.value) as MentionedInChannelProps;

      await summaryInProgressMessage(client, {
        channel: props.channelId,
        user: body.user.id,
        trigger_context: props.triggerContext,
      });

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

      await channelSummarizer.summarize(
        'user_mentioned',
        context.botId || '',
        body.team?.id || 'unknown',
        body.user.id,
        {
          type: 'channel',
          channelId: props.channelId,
          channelName: channel.name,
        },
        3,
        client,
      );

      if (props.triggerContext === 'in_dm') {
        await client.chat.postMessage({
          channel: body.user.id,
          text: `Great, your summary was created! Go and see your summary in <#${props.channelId}>`,
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
      metricsReporter.error(
        'summarize channel after mention',
        'summarize-channel-after-mention',
      );
      logger.error(
        `error in summarize suggested channel after mention: ${error} ${error.stack}`,
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

  const props: MentionedInChannelProps = {
    channelId: channelId,
    triggerContext: presence === 'away' ? 'in_dm' : 'in_channel',
  };

  const shouldTrigger =
    await newUserTriggersManager.shouldTriggerForPotentialUser(
      'channel_mention',
      teamId,
      userId,
      presence,
    );

  if (!shouldTrigger) {
    logger.debug(`should not trigger user ${userId}, skipping`);
    return null;
  }
  const blocksText = MentionedInChannelText(
    presence,
    botUserId,
    userId,
    channelId,
  );
  const blocks = MentionedInChannel(blocksText, props);

  analyticsManager.messageSentToUserDM({
    type: 'suggest_channel_summary',
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
      text: blocksText,
      blocks: blocks,
    });
  }

  return client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text: blocksText,
    blocks: blocks,
  });
};
