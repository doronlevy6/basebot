import { logger } from '@base/logger';
import { AnalyticsManager } from '../analytics/manager';
import { Routes } from '../routes/router';
import { SlackBlockActionWrapper, ViewAction } from '../slack/types';
import { UserFeedbackManager } from './manager';
import { NewUserTriggersManager } from '../new-user-triggers/manager';
import { extractTriggerFeedback } from '../slack/components/trigger-feedback';

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
      const sessionId = view.private_metadata;

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
          gist_session: sessionId,
        },
      });

      if (!submitted) {
        return;
      }

      await userFeedbackManager.sendUserFeedback(
        client,
        body.user.id,
        body.team?.id || 'unknown',
        sessionId,
        feedback,
      );
    } catch (err) {
      logger.error(`user feedback submit handler error: ${err.stack}`);
    }
  };
export const handleUserTriggerFeedback =
  (
    analyticsManager: AnalyticsManager,
    newUserTriggerManager: NewUserTriggersManager,
  ) =>
  async ({ ack, logger, body }: SlackBlockActionWrapper) => {
    try {
      await ack();
      if (!body.state?.values) {
        logger.error(`no content for user action found`);
        return;
      }
      let feedback = '';
      feedback =
        Object.values(body.state.values)[0][Routes.TRIGGER_FEEDBACK]
          .selected_option?.value || '';
      const [feedbackValue, feedBackContext] = extractTriggerFeedback(feedback);
      analyticsManager.triggerFeedback({
        type: 'user_trigger_feedback',
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || 'unknown',
        extraParams: {
          trigger_source: feedBackContext,
          trigger_value: feedbackValue,
        },
      });
      if (feedbackValue === 'false') {
        await newUserTriggerManager.handleTriggerBlock(
          feedBackContext,
          body.team?.id || 'unknown',
          body.user.id,
        );
      }
      if (feedbackValue === 'true') {
        await newUserTriggerManager.handleTriggerHelpful(
          feedBackContext,
          body.team?.id || 'unknown',
          body.user.id,
        );
      }
    } catch (err) {
      logger.error(`user feedback submit handler error: ${err.stack}`);
    }
  };

export const openFeedbackModalHandler =
  (analyticsManager: AnalyticsManager) =>
  async ({ ack, logger, body, client }: SlackBlockActionWrapper) => {
    try {
      await ack();

      const action = body.actions[0];
      if (action.type !== 'button') {
        throw new Error(
          'open feedback modal handler received non-button action',
        );
      }
      if (action.value === '') {
        throw new Error(
          'open feedback modal handler received empty button action',
        );
      }

      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          notify_on_close: true,
          callback_id: Routes.USER_FEEDBACK_MODAL_SUBMIT,
          private_metadata: action.value,
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
