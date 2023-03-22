import { AnalyticsManager } from '@base/gistbot-shared';
import { HomeDataStore } from '../../home/home-data-store';
import { SlackBlockActionWrapper } from '../../slack/types';
import { EventEmitter } from 'events';
import { UPDATE_HOME_EVENT_NAME } from '../../home/types';

export const dismissedOnBoarding =
  (
    homeDataStore: HomeDataStore,
    analyticsManager: AnalyticsManager,
    eventsEmitter: EventEmitter,
  ) =>
  async ({ ack, logger, body }: SlackBlockActionWrapper) => {
    try {
      await ack();
      logger.info('recived confirmed action to disconnect from gmail');
      const slackUserId = body.user.id;
      if (!slackUserId) {
        logger.error('could not find slack user id');
        return;
      }

      const slackTeamId = body.team?.id;
      if (!slackTeamId) {
        logger.error('could not find slack team id');
        return;
      }
      analyticsManager.gmailDismissOnboarding({ slackUserId, slackTeamId });
      await homeDataStore.dismissOnboarding(slackUserId, slackTeamId);
      eventsEmitter.emit(UPDATE_HOME_EVENT_NAME, {
        slackUserId,
        slackTeamId,
      });
    } catch (e) {
      logger.error(
        `could not dismiss gmail onBoarding message for user ${body.user.id} on team ${body.team?.id}`,
        e,
      );
    }
  };
