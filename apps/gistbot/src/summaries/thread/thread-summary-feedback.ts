import { SlackBlockActionWrapper } from '../../slack/types';
import { AnalyticsManager } from '@base/gistbot-shared';
import { UserFeedbackManager } from '../../user-feedback/manager';
import { extractSessionIdAndValueFromFeedback } from '../../slack/components/summary-feedback';
import { SummaryStore } from '../summary-store';
import { BlockAction, BlockElementAction } from '@slack/bolt';
import { logger } from '@base/logger';
import { SessionDataStore } from '../session-data/session-data-store';
import { IReporter } from '@base/metrics';

export const threadSummaryFeedbackHandler =
  (
    analyticsManager: AnalyticsManager,
    metricsReporter: IReporter,
    feedbackManager: UserFeedbackManager,
    summaryStore: SummaryStore,
    sessionDataStore: SessionDataStore,
  ) =>
  async ({ ack, logger, payload, body, client }: SlackBlockActionWrapper) => {
    try {
      await ack();

      if (payload.type !== 'static_select') {
        throw new Error(
          `received ${payload.type} instead of static_select in feedback handler`,
        );
      }

      if (!body.channel) {
        logger.error({
          msg: `no channel in body`,
          body: body,
        });
        throw new Error('no channel in body');
      }

      const [sessionId, feedbackValue] = extractSessionIdAndValueFromFeedback(
        payload.selected_option.value,
      );

      sessionDataStore
        .storeSessionFeedback({
          sessionId: sessionId,
          teamId: body.user.team_id || 'unknown',
          userId: body.user.id,
          feedback: feedbackValue,
        })
        .catch((e) =>
          logger.error({
            msg: `failed to store feedback for thread session: ${sessionId}`,
            error: e,
          }),
        );

      const threadTs = await extractThreadTs(sessionId, summaryStore, body);

      logger.info(
        `${body.user.id} is returning feedback ${feedbackValue} on ${threadTs} in channel ${body.channel.id}`,
      );

      analyticsManager.threadSummaryFunnel({
        funnelStep: 'summary_feedback',
        slackTeamId: body.user.team_id || 'unknown',
        slackUserId: body.user.id,
        channelId: body.channel.id,
        threadTs: threadTs,
        extraParams: {
          feedback_value: feedbackValue,
          gist_session: sessionId,
        },
      });

      await feedbackManager.askForFeedback(
        client,
        body.channel.id,
        body.user.id,
        sessionId,
        threadTs,
      );
    } catch (error) {
      metricsReporter.error('thread summarizer', 'summarization-feedback');
      logger.error(`error in thread summary feedback: ${error.stack}`);
    }
  };

const extractThreadTs = async (
  sessionId: string,
  summaryStore: SummaryStore,
  body: BlockAction<BlockElementAction>,
): Promise<string> => {
  if (body.message && body.message['thread_ts']) {
    return body.message['thread_ts'] as string;
  }

  const summary = await summaryStore.get(sessionId);
  if (summary) {
    if (!summary.threadTs) {
      throw new Error('thread summary feedback has summary without thread ts');
    }
    return summary.threadTs;
  }

  logger.warn({
    msg: 'summary has expired for feedback',
    session_id: sessionId,
  });
  throw new Error('no summary store and no thread ts in body');
};
