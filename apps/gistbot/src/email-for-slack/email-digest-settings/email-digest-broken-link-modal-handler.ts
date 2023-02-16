import { AnalyticsManager } from '@base/gistbot-shared';
import { logger } from '@base/logger';
import { EmailSettingsBrokenLinkModal } from './email-settings-broken-links-modal';
import {
  SlackBlockActionWrapper,
  SlackSlashCommandWrapper,
  ViewAction,
} from '../../slack/types';
import { updateAccountUsingGmailIUrl } from './email-digest-settings-client';

const URL_BLOCK_ID = 'gmail-url';
const URL_ACTION_ID = 'url';

export const showEmailDigestBrokenLinksModal =
  (analyticsManager: AnalyticsManager) =>
  async ({
    ack,
    logger,
    body,
    client,
  }: SlackBlockActionWrapper | SlackSlashCommandWrapper) => {
    try {
      await ack();
      logger.debug(`showEmailDigestBrokenLinksModal ${body}`);

      await client.views.push({
        trigger_id: body.trigger_id,
        view: EmailSettingsBrokenLinkModal({
          urlBlockActionId: URL_ACTION_ID,
          urlBlockId: URL_BLOCK_ID,
        }),
      });

      analyticsManager.buttonClicked({
        type: 'email-broken-links-settings-button',
        slackTeamId: body.team?.id,
        slackUserId: body.user.id,
      });
    } catch (err) {
      logger.error(`email schedule settings load error: ${err} ${err.stack}`);
    }
  };

export const emailSettingsBrokenLinkSubmitted =
  (analyticsManager: AnalyticsManager) => async (params: ViewAction) => {
    const { ack, body, view } = params;
    try {
      await ack();

      logger.debug(
        `email broken link modal submited for user ${
          body.user.id
        } ${JSON.stringify(body)}`,
      );

      if (!body.team?.id) {
        logger.error(
          `team id not exist for user ${body.user.id} in email scheduler settings modal`,
        );
        return;
      }

      const url = view.state.values[URL_BLOCK_ID][URL_ACTION_ID]?.value;
      if (!url) {
        logger.error(
          `url not exist for user ${body.user.id} in email scheduler settings modal`,
        );
        return;
      }

      // TODO: pass slack user id and team and not mail
      await updateAccountUsingGmailIUrl(
        { slackTeamId: body.team?.id, slackUserId: body.user.id },
        url,
      );

      analyticsManager.buttonClicked({
        type: 'broken-email-modal-submit',
        slackTeamId: body.team.id,
        slackUserId: body.user.id,
      });
    } catch (ex) {
      logger.error(
        `error occured in email broken links modal for user ${body.user.id}, error:  ${ex}`,
      );
    }
  };
