import { SlackShortcutWrapper } from '../slack/types';
import { addToChannelInstructions } from '../slack/add-to-channel';
import { summaryInProgressMessage } from './utils';
import { AnalyticsManager } from '../analytics/manager';
import { privateChannelInstructions } from '../slack/private-channel';
import { identifyTriggeringUser } from '../slack/utils';
import { ThreadSummarizer } from './thread/thread-summarizer';

export const threadSummarizationHandler =
  (analyticsManager: AnalyticsManager, threadSummarizer: ThreadSummarizer) =>
  async ({
    shortcut,
    ack,
    client,
    logger,
    payload,
    respond,
    context,
  }: SlackShortcutWrapper) => {
    try {
      await ack();

      if (!payload.message.user && !payload.message['bot_id']) {
        throw new Error('cannot extract user from empty user');
      }

      analyticsManager.threadSummaryFunnel({
        funnelStep: 'user_requested',
        slackTeamId: payload.team?.id || 'unknown',
        slackUserId: payload.user.id,
        channelId: payload.channel.id,
        threadTs: payload.message_ts,
      });

      await summaryInProgressMessage(
        client,
        payload.channel.id,
        payload.user.id,
        payload.message_ts,
      );

      analyticsManager.threadSummaryFunnel({
        funnelStep: 'in_progress_sent',
        slackTeamId: payload.team?.id || 'unknown',
        slackUserId: payload.user.id,
        channelId: payload.channel.id,
        threadTs: payload.message_ts,
      });

      // Don't await so that we don't force anything to wait just for the identification.
      // This handles error handling internally and will never cause an exception, so we
      // won't have any unhandled promise rejection errors.
      identifyTriggeringUser(
        payload.user.id,
        payload.team?.id || 'unknown',
        client,
        analyticsManager,
      );

      logger.info(
        `${shortcut.user.id} requested a thread summarization on ${payload.message.ts} in channel ${payload.channel.id}`,
      );

      await threadSummarizer.summarize(
        context.botId || '',
        payload.team?.id || 'unknown',
        payload.user.id,
        {
          type: 'thread',
          threadTs: payload.message_ts,
          channelId: payload.channel.id,
          channelName: payload.channel.name,
        },
        client,
        respond,
      );
    } catch (error) {
      logger.error(`error in thread summarization: ${error.stack}`);

      if ((error as Error).message.toLowerCase().includes('not_in_channel')) {
        await addToChannelInstructions(
          client,
          shortcut.trigger_id,
          {
            channelId: payload.channel.id,
            channelName: payload.channel.name,
            currentUser: payload.user.id,
            teamId: payload.user.team_id || 'unknown',
            summarization: {
              type: 'thread',
              channelId: payload.channel.id,
              threadTs: payload.message_ts,
              channelName: payload.channel.name,
            },
          },
          analyticsManager,
        );
        analyticsManager.threadSummaryFunnel({
          funnelStep: 'not_in_channel',
          slackTeamId: payload.team?.id || 'unknown',
          slackUserId: payload.user.id,
          channelId: payload.channel.id,
          threadTs: payload.message_ts,
        });
        return;
      }

      if (
        (error as Error).message.toLowerCase().includes('channel_not_found') ||
        (error as Error).message.toLowerCase().includes('missing_scope')
      ) {
        await privateChannelInstructions(
          client,
          payload.trigger_id,
          {
            channelId: payload.channel.id,
            channelName: payload.channel.name,
            currentUser: payload.user.id,
            teamId: payload.user.team_id || 'unknown',
          },
          analyticsManager,
        );
        analyticsManager.threadSummaryFunnel({
          funnelStep: 'private_channel',
          slackTeamId: payload.team?.id || 'unknown',
          slackUserId: payload.user.id,
          channelId: payload.channel.id,
          threadTs: payload.message_ts,
        });
        return;
      }
    }
  };
