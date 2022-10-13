import { AnalyticsManager } from '../../analytics/manager';
import { SlackBlockActionWrapper } from '../../slack/types';

import { Routes } from '../../routes/router';
import { Summary } from '../../slack/components/summary';
import { SummaryStore } from '../summary-store';

export const channelSummaryPostHandler =
  (analyticsManager: AnalyticsManager, summaryStore: SummaryStore) =>
  async ({
    ack,
    logger,
    body,
    respond,
    payload,
    context,
  }: SlackBlockActionWrapper) => {
    try {
      await ack();

      if (payload.type !== 'button') {
        throw new Error('Cannot parse action with non button type');
      }

      const { value } = payload;
      const summary = await summaryStore.get(value);

      const { botUserId } = context;
      if (!botUserId) {
        throw new Error('Missing context of bot user id');
      }

      const canPost = !!summary;
      if (!canPost) {
        logger.warn(`Post clicked with summary not in cache ${body.team?.id}`);
        await respond({
          replace_original: false,
          response_type: 'ephemeral',
          text: 'Gistbot does not have access to the summary as more than 1 hour had passed. You can copy and share this text, or create a new summary.',
        });

        analyticsManager.channelSummaryFunnel({
          funnelStep: 'post_summary',
          slackTeamId: body.user.team_id || 'unknown',
          slackUserId: body.user.id,
          channelId: body.channel?.id || 'unknown',
          extraParams: {
            success: false,
          },
        });

        return;
      }

      const { blocks, title } = Summary({
        actionIds: {
          feedback: Routes.CHANNEL_SUMMARY_FEEDBACK,
          addToChannels: Routes.ADD_TO_CHANNEL_FROM_WELCOME_MODAL,
        },
        userId: body.user.id,
        startTimeStamp: summary.startDate,
        summary: summary.text,
        myBotUserId: botUserId,
        isThread: false,
      });

      await respond({
        delete_original: true,
        response_type: 'in_channel',
        blocks,
        text: title,
      });

      analyticsManager.channelSummaryFunnel({
        funnelStep: 'post_summary',
        slackTeamId: body.user.team_id || 'unknown',
        slackUserId: body.user.id,
        channelId: body.channel?.id || 'unknown',
        extraParams: {
          success: true,
        },
      });
    } catch (error) {
      logger.error(
        `error in post summary to channel: ${body.team?.id} ${body.user.id} ${error.stack}`,
      );
    }
  };
