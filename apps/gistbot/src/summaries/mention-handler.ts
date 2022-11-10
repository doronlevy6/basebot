import { GenericMessageEvent } from '@slack/bolt';
import { AnalyticsManager } from '../analytics/manager';
import { OnboardingManager } from '../onboarding/manager';
import { parseSlackMrkdwn } from '../slack/parser';
import { SlackEventWrapper } from '../slack/types';
import { ChannelSummarizer } from './channel/channel-summarizer';
import { ThreadSummarizer } from './thread/thread-summarizer';
import { extractDaysBack, summaryInProgressMessage } from './utils';
import { IReporter } from '@base/metrics';
import { MultiChannelSummarizer } from './channel/multi-channel-summarizer';

export const mentionHandler =
  (
    analyticsManager: AnalyticsManager,
    metricsReporter: IReporter,
    channelSummarizer: ChannelSummarizer,
    threadSummarizer: ThreadSummarizer,
    onboardingManager: OnboardingManager,
    multiChannelSummarizer: MultiChannelSummarizer,
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

      if (parsedMrkdwn.sections.find((v) => v.type === 'channel_link')) {
        const channelIds = parsedMrkdwn.sections
          .filter((v) => v.type === 'channel_link')
          .map((v) => {
            if (v.type !== 'channel_link') {
              throw new Error('not possible');
            }
            return v.channelId;
          });

        const channelNames = await Promise.all(
          channelIds.map(async (channelId) => {
            const {
              error: infoError,
              ok: infoOk,
              channel: channel,
            } = await client.conversations.info({
              channel: channelId,
            });
            if (infoError || !infoOk) {
              throw new Error(`Failed to fetch channel info ${infoError}`);
            }

            if (!channel) {
              throw new Error(`Failed to fetch channel info not found`);
            }

            return channel.name;
          }),
        );

        const summaries = await multiChannelSummarizer.summarize(
          'mention_manually',
          context.botId || '',
          team_id,
          event.user,
          {
            type: 'multi_channel',
            channels: channelIds.map((cid, idx) => {
              return {
                channelId: cid,
                channelName: channelNames[idx] as string,
              };
            }),
          },
          client,
          1,
        );

        const formattedMultiChannel =
          await multiChannelSummarizer.getMultiChannelSummaryFormatted(
            summaries,
            client,
          );

        client.chat.postEphemeral({
          user: event.user,
          channel: event.channel,
          text: formattedMultiChannel,
        });
        return;
      }

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
