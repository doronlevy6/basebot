import { ChannelJoinMessageEvent } from '@slack/bolt';
import { AnalyticsManager } from '../analytics/manager';
import { OnboardingManager } from '../onboarding/manager';
import { SlackEventWrapper } from '../slack/types';
import { ChannelSummarizer } from './channel/channel-summarizer';
import { summaryInProgressMessage } from './utils';

const MINIMUM_MESSAGES_ON_CHANNEL_JOIN = 10;

export const channelJoinHandler =
  (
    analyticsManager: AnalyticsManager,
    channelSummarizer: ChannelSummarizer,
    onboardingManager: OnboardingManager,
  ) =>
  async ({ client, logger, body, context }: SlackEventWrapper<'message'>) => {
    try {
      const { team_id } = body;
      const event = body.event as ChannelJoinMessageEvent;
      logger.info(`${event.user} has joined ${event.channel}`);

      await onboardingManager.onboardUser(
        team_id,
        event.user,
        client,
        'channel_join',
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

      await summaryInProgressMessage(client, event.channel, event.user);

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

      await channelSummarizer.summarize(
        'channel_joined',
        context.botId || '',
        team_id,
        event.user,
        {
          type: 'channel',
          channelId: event.channel,
          channelName: channel.name,
        },
        client,
        undefined,
        MINIMUM_MESSAGES_ON_CHANNEL_JOIN,
      );
    } catch (error) {
      logger.error(
        `error in handling channel join summarization: ${error} ${error.stack}`,
      );
    }
  };
