import { SlackBlockActionWrapper } from '../../slack/types';
import { AnalyticsManager } from '@base/gistbot-shared';
import { UserFeedbackManager } from '../../user-feedback/manager';
import { extractSessionIdAndValueFromFeedback } from '../../slack/components/summary-feedback';
import { SessionDataStore } from '../session-data/session-data-store';
import { IReporter } from '@base/metrics';

export const channelSummaryFeedbackHandler =
  (
    analyticsManager: AnalyticsManager,
    feedbackManager: UserFeedbackManager,
    sessionDataStore: SessionDataStore,
    metricsReporter: IReporter,
  ) =>
  async ({ ack, logger, payload, body, client }: SlackBlockActionWrapper) => {
    try {
      await ack();

      if (payload.type !== 'static_select') {
        throw new Error(
          `received ${payload.type} instead of static_select in channel feedback handler`,
        );
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
            msg: `failed to store feedback for channel session: ${sessionId}`,
            error: e,
          }),
        );

      const messageTs = body.message?.text || body.container['message_ts'];
      if (!body.channel || !messageTs) {
        logger.error({ msg: `no channel or message in body`, body: body });
        throw new Error('no channel or message in body');
      }

      logger.info(
        `${body.user.id} is returning feedback ${feedbackValue} on ${messageTs} in channel ${body.channel.id}`,
      );

      analyticsManager.channelSummaryFunnel({
        funnelStep: 'summary_feedback',
        slackTeamId: body.user.team_id || 'unknown',
        slackUserId: body.user.id,
        channelId: body.channel.id,
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
      );
    } catch (error) {
      metricsReporter.error('channel summarizer', 'summarization-feedback');
      logger.error(`error in channel summary feedback: ${error.stack}`);
    }
  };
