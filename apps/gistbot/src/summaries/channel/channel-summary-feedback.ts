import { SlackBlockActionWrapper } from '../../slack/types';
import { AnalyticsManager } from '../../analytics/manager';
import { UserFeedbackManager } from '../../user-feedback/manager';
import { extractSessionIdAndValueFromFeedback } from '../../slack/components/summary-feedback';

export const channelSummaryFeedbackHandler =
  (analyticsManager: AnalyticsManager, feedbackManager: UserFeedbackManager) =>
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
      );
    } catch (error) {
      logger.error(`error in channel summary feedback: ${error.stack}`);
    }
  };
