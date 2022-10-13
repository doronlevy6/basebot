import { GenericMessageEvent } from '@slack/bolt';
import { AnalyticsManager } from '../analytics/manager';
import { OnboardingManager } from '../onboarding/manager';
import { SlackEventWrapper } from '../slack/types';
import {
  ChannelSummarizer,
  DEFAULT_DAYS_BACK,
} from './channel/channel-summarizer';
import { ThreadSummarizer } from './thread/thread-summarizer';
import { summaryInProgressMessage } from './utils';

export const mentionHandler =
  (
    analyticsManager: AnalyticsManager,
    channelSummarizer: ChannelSummarizer,
    threadSummarizer: ThreadSummarizer,
    onboardingManager: OnboardingManager,
  ) =>
  async ({ client, logger, body, context }: SlackEventWrapper<'message'>) => {
    try {
      const { team_id } = body;
      const event = body.event as GenericMessageEvent;
      logger.info(`${event.user} mentioned us in ${event.channel}`);

      await onboardingManager.onboardUser(
        team_id,
        event.user,
        client,
        'direct_mention',
        context.botUserId,
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
        'bot_mentioned',
        context.botId || '',
        team_id,
        event.user,
        {
          type: 'channel',
          channelId: event.channel,
          channelName: channel.name,
        },
        DEFAULT_DAYS_BACK,
        client,
      );
    } catch (error) {
      logger.error(
        `error in handling mention summarization: ${error} ${error.stack}`,
      );
    }
  };
