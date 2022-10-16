import { logger } from '@base/logger';
import { AnalyticsManager } from '../analytics/manager';
import { Routes } from '../routes/router';
import { SlackBlockActionWrapper, ViewAction } from '../slack/types';
import { UserFeedbackManager } from './manager';

const SEND_USER_FEEDBACK_INPUT = 'user-feedback-input';

export const handleUserFeedbackSubmit =
  (
    analyticsManager: AnalyticsManager,
    userFeedbackManager: UserFeedbackManager,
  ) =>
  async (params: ViewAction) => {
    const { ack, view, client, body } = params;

    try {
      await ack();

      const submitted = body.type === 'view_submission';

      let feedback = '';
      if (submitted) {
        feedback =
          Object.values(view.state.values)[0][SEND_USER_FEEDBACK_INPUT].value ||
          '';
      }

      analyticsManager.modalClosed({
        type: 'user_feedback',
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || 'unknown',
        submitted: submitted,
        properties: {
          feedback: feedback,
        },
      });

      if (!submitted) {
        return;
      }

      await userFeedbackManager.sendUserFeedback(
        client,
        body.user.id,
        body.team?.id || 'unknown',
        feedback,
      );
    } catch (err) {
      logger.error(`user feedback submit handler error: ${err.stack}`);
    }
  };

export const openFeedbackModalHandler =
  (analyticsManager: AnalyticsManager) =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    try {
      await ack();

      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          notify_on_close: true,
          callback_id: Routes.USER_FEEDBACK_MODAL_SUBMIT,
          submit: {
            type: 'plain_text',
            text: 'Submit',
            emoji: true,
          },
          close: {
            type: 'plain_text',
            text: 'Cancel',
            emoji: true,
          },
          title: {
            type: 'plain_text',
            text: `Feedback`,
            emoji: true,
          },
          blocks: [
            {
              type: 'input',
              element: {
                type: 'plain_text_input',
                multiline: true,
                action_id: SEND_USER_FEEDBACK_INPUT,
              },
              label: {
                type: 'plain_text',
                text: 'We would love to hear your thoughts',
                emoji: true,
              },
            },
          ],
        },
      });

      analyticsManager.modalView({
        type: 'user_feedback',
        slackUserId: body.user.id,
        slackTeamId: body.user.team_id || 'unknown',
      });
    } catch (error) {
      logger.error(`error in user feedback: ${error.stack}`);
    }
  };
