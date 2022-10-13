import { AnalyticsManager } from '../../analytics/manager';
import { SlackBlockActionWrapper } from '../../slack/types';

import { Routes } from '../../routes/router';
import { Summary } from '../../slack/components/summary';
import { SummaryStore } from '../summary-store';

export const threadSummaryPostHandler =
  (analyticsManager: AnalyticsManager, summaryStore: SummaryStore) =>
  async ({
    ack,
    logger,
    body,
    payload,
    respond,
    client,
    context,
  }: SlackBlockActionWrapper) => {
    try {
      await ack();

      if (payload.type !== 'button') {
        throw new Error('Cannot parse action with non button type');
      }

      const { botUserId } = context;
      if (!botUserId || !body.channel) {
        throw new Error('Missing context');
      }

      const { value } = payload;
      const summary = await summaryStore.get(value);
      const canPost = !!summary;
      if (!canPost) {
        logger.warn(`Post clicked with summary not in cache ${body.team?.id}`);
        await respond({
          delete_original: false,
          response_type: 'ephemeral',
          text: 'Gistbot does not have access to the summary as more than 1 hour had passed. You can copy and share this text, or create a new summary.',
        });

        analyticsManager.threadSummaryFunnel({
          funnelStep: 'post_summary',
          slackTeamId: body.user.team_id || 'unknown',
          slackUserId: body.user.id,
          channelId: body.channel.id,
          threadTs: 'unknown',
          extraParams: {
            success: false,
          },
        });

        return;
      }

      const { startDate, threadTs, text } = summary;
      if (!threadTs) {
        throw new Error(
          'Thread summary posting handler called with no threadTs',
        );
      }
      const { blocks, title } = Summary({
        actionIds: {
          feedback: Routes.CHANNEL_SUMMARY_FEEDBACK,
          addToChannels: Routes.ADD_TO_CHANNEL_FROM_WELCOME_MODAL,
        },
        userId: body.user.id,
        startTimeStamp: startDate,
        summary: text,
        myBotUserId: botUserId,
        isThread: true,
      });

      await Promise.all([
        respond({
          delete_original: true,
        }),
        client.chat.postMessage({
          channel: body.channel.id,
          blocks,
          text: title,
          thread_ts: summary.threadTs,
        }),
      ]);

      analyticsManager.threadSummaryFunnel({
        funnelStep: 'post_summary',
        slackTeamId: body.user.team_id || 'unknown',
        slackUserId: body.user.id,
        channelId: body.channel.id,
        threadTs,
        extraParams: {
          success: true,
        },
      });
    } catch (error) {
      logger.error(`error in post summary to thread: ${error.stack}`);
    }
  };
