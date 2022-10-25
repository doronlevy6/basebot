import { GenericMessageEvent } from '@slack/bolt';
import { AnalyticsManager } from '../analytics/manager';
import { OnboardingManager } from '../onboarding/manager';
import { parseSlackMrkdwn } from '../slack/parser';
import { SlackEventWrapper } from '../slack/types';
import { ChannelSummarizer } from './channel/channel-summarizer';
import { ThreadSummarizer } from './thread/thread-summarizer';
import { extractDaysBack, summaryInProgressMessage } from './utils';
import { IReporter } from '@base/metrics';

export const mentionHandler =
  (
    analyticsManager: AnalyticsManager,
    metricsReporter: IReporter,
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

      await summaryInProgressMessage(client, {
        thread_ts: event.thread_ts,
        channel: event.channel,
        user: event.user,
      });

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

      const parsedMrkdwn = parseSlackMrkdwn(event.text || '');
      parsedMrkdwn.sections.shift();
      const textWithoutFirstMention = await parsedMrkdwn.plainText(
        team_id,
        client,
      );

      const daysBack = extractDaysBack(textWithoutFirstMention);

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
        daysBack,
        client,
        undefined,
        event.ts,
      );
    } catch (error) {
      metricsReporter.error('mention summarization', 'mention-summarization');
      logger.error(
        `error in handling mention summarization: ${error} ${error.stack}`,
      );
    }
  };
