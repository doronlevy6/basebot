import { logger } from '@base/logger';
import { GenericMessageEvent } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '../analytics/manager';
import { UserOnboardedNotifier } from '../onboarding/notifier';
import { OnboardingStore } from '../onboarding/onboardingStore';
import { UserLink } from '../slack/components/user-link';
import { Welcome } from '../slack/components/welcome';
import { SlackEventWrapper } from '../slack/types';
import { ChannelSummarizer } from './channel/channel-summarizer';
import { ThreadSummarizer } from './thread/thread-summarizer';
import { summaryInProgressMessage } from './utils';

export const mentionHandler =
  (
    analyticsManager: AnalyticsManager,
    channelSummarizer: ChannelSummarizer,
    threadSummarizer: ThreadSummarizer,
    onboardingStore: OnboardingStore,
    onboardingNotifier: UserOnboardedNotifier,
  ) =>
  async ({ client, logger, body, context }: SlackEventWrapper<'message'>) => {
    try {
      const { team_id } = body;
      const event = body.event as GenericMessageEvent;
      logger.info(`${event.user} mentioned us in ${event.channel}`);

      await checkAndOnboard(
        team_id,
        event.user,
        context.botUserId || '',
        event.channel,
        client,
        onboardingStore,
        analyticsManager,
        onboardingNotifier,
      );

      analyticsManager.botMentioned({
        slackTeamId: team_id,
        slackUserId: event.user,
        channelId: event.channel,
        properties: {
          mention_message_text: event.text || '',
        },
      });

      await summaryInProgressMessage(
        client,
        event.channel,
        event.user,
        event.thread_ts,
      );

      const { error, ok, channel } = await client.conversations.info({
        channel: event.channel,
      });

      if (error || !ok) {
        throw new Error(`Failed to fetch conversation info ${error}`);
      }

      if (!channel || !channel.name) {
        throw new Error(
          `Failed to fetch conversation info conversation not found`,
        );
      }

      if (event.thread_ts) {
        await threadSummarizer.summarize(
          context.botId || '',
          team_id,
          event.user,
          {
            type: 'thread',
            channelId: event.channel,
            channelName: channel.name,
            threadTs: event.thread_ts,
          },
          client,
        );
        return;
      }

      await channelSummarizer.summarize(
        context.botId || '',
        team_id,
        event.user,
        {
          type: 'channel',
          channelId: event.channel,
          channelName: channel.name,
        },
        client,
      );
    } catch (error) {
      logger.error(
        `error in handling mention summarization: ${error} ${error.stack}`,
      );
    }
  };

export const checkAndOnboard = async (
  teamId: string,
  userId: string,
  botUserId: string,
  channelId: string,
  client: WebClient,
  onboardingStore: OnboardingStore,
  analyticsManager: AnalyticsManager,
  onboardingNotifier: UserOnboardedNotifier,
) => {
  try {
    const wasOnboarded = await onboardingStore.wasUserOnboarded(teamId, userId);

    if (!wasOnboarded) {
      await client.chat.postEphemeral({
        text: `Hey ${UserLink(userId)} :wave: I'm theGist!`,
        blocks: Welcome(userId, botUserId || ''),
        user: userId,
        channel: channelId,
      });

      analyticsManager.messageSentToUserDM({
        type: 'onboarding_message',
        slackTeamId: teamId,
        slackUserId: userId,
        properties: {
          ephemeral: true,
        },
      });

      await onboardingStore.userOnboarded(teamId, userId);

      // Don't await so that we don't force anything to wait just for the notification.
      // This handles error handling internally and will never cause an exception, so we
      // won't have any unhandled promise rejection errors.
      onboardingNotifier.notify(client, userId, teamId);
    }
  } catch (error) {
    logger.error(
      `error checking if the user was onboarded: ${error} - ${error.stack}`,
    );
  }
};
