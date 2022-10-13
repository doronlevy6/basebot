import { addToChannelInstructions } from '../slack/add-to-channel';
import { SlackSlashCommandWrapper } from '../slack/types';
import { AnalyticsManager } from '../analytics/manager';
import { privateChannelInstructions } from '../slack/private-channel';
import { identifyTriggeringUser } from '../slack/utils';
import {
  ChannelSummarizer,
  DEFAULT_DAYS_BACK,
} from './channel/channel-summarizer';
import { summaryInProgressMessage } from './utils';

export const channelSummarizationHandler =
  (analyticsManager: AnalyticsManager, channelSummarizer: ChannelSummarizer) =>
  async ({
    ack,
    client,
    logger,
    payload,
    respond,
    context,
  }: SlackSlashCommandWrapper) => {
    try {
      await ack();

      analyticsManager.channelSummaryFunnel({
        funnelStep: 'user_requested',
        slackTeamId: payload.team_id,
        slackUserId: payload.user_id,
        channelId: payload.channel_id,
      });

      await summaryInProgressMessage(
        client,
        payload.channel_id,
        payload.user_id,
      );

      analyticsManager.channelSummaryFunnel({
        funnelStep: 'in_progress_sent',
        slackTeamId: payload.team_id,
        slackUserId: payload.user_id,
        channelId: payload.channel_id,
      });

      const { channel_id, user_id, channel_name, team_id } = payload;

      // Don't await so that we don't force anything to wait just for the identification.
      // This handles error handling internally and will never cause an exception, so we
      // won't have any unhandled promise rejection errors.
      identifyTriggeringUser(user_id, team_id, client, analyticsManager);

      logger.info(
        `${user_id} requested a channel summarization on ${channel_name}`,
      );

      await channelSummarizer.summarize(
        'slash_command',
        context.botId || '',
        team_id,
        user_id,
        {
          type: 'channel',
          channelId: channel_id,
          channelName: channel_name,
        },
        DEFAULT_DAYS_BACK,
        client,
        respond,
      );
    } catch (error) {
      logger.error(`error in channel summarization: ${error} ${error.stack}`);

      if ((error as Error).message.toLowerCase().includes('not_in_channel')) {
        await addToChannelInstructions(
          client,
          payload.trigger_id,
          {
            channelId: payload.channel_id,
            channelName: payload.channel_name,
            currentUser: payload.user_id,
            teamId: payload.team_id,
            summarization: {
              type: 'channel',
              channelId: payload.channel_id,
              channelName: payload.channel_name,
            },
          },
          analyticsManager,
          context.botUserId || '',
        );
        analyticsManager.channelSummaryFunnel({
          funnelStep: 'not_in_channel',
          slackTeamId: payload.team_id,
          slackUserId: payload.user_id,
          channelId: payload.channel_id,
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
            channelId: payload.channel_id,
            channelName: payload.channel_name,
            currentUser: payload.user_id,
            teamId: payload.team_id,
          },
          analyticsManager,
          context.botUserId || '',
        );
        analyticsManager.channelSummaryFunnel({
          funnelStep: 'private_channel',
          slackTeamId: payload.team_id,
          slackUserId: payload.user_id,
          channelId: payload.channel_id,
        });
        return;
      }
    }
  };
