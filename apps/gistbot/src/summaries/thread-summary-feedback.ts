import { SlackBlockActionWrapper } from '../slack/types';
import { AnalyticsManager } from '../analytics/manager';

export const threadSummaryFeedbackHandler =
  (analyticsManager: AnalyticsManager) =>
  async ({ ack, logger, payload, body }: SlackBlockActionWrapper) => {
    try {
      await ack();

      if (payload.type !== 'static_select') {
        throw new Error(
          `received ${payload.type} instead of static_select in feedback handler`,
        );
      }

      if (!body.channel || !body.message) {
        logger.error({ msg: `no channel or message in body`, body: body });
        throw new Error('no channel or message in body');
      }

      logger.info(
        `${body.user.id} is returning feedback ${payload.selected_option.value} on ${body.message.ts} in channel ${body.channel.id}`,
      );

      analyticsManager.threadSummaryFunnel({
        funnelStep: 'summary_feedback',
        slackTeamId: body.user.team_id || 'unknown',
        slackUserId: body.user.id,
        channelId: body.channel.id,
        threadTs: body.message['thread_ts'] || body.message.ts,
        extraParams: {
          feedback_value: payload.selected_option.value,
        },
      });
    } catch (error) {
      logger.error(`error in thread summary feedback: ${error.stack}`);
    }
  };
