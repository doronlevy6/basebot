import { AnalyticsManager } from '@base/gistbot-shared';
import EventEmitter = require('events');
import { SlackBlockActionWrapper } from '../../slack/types';
import { DigestAction } from '../types';
import { archiveAll } from './archive-all';
import { markAllAsRead } from './mark-all-as-read';
import { DISPLAY_ERROR_MODAL_EVENT_NAME } from '../../home/types';
import { IMailErrorMetaData } from '../views/email-error-view';

export type SectionActionProps = Pick<
  SlackBlockActionWrapper,
  'logger' | 'body'
>;

export const sectionActionsHandler =
  (analyticsManager: AnalyticsManager, eventsEmitter: EventEmitter) =>
  async ({ ack, body, logger }: SlackBlockActionWrapper) => {
    await ack();
    const action = body.actions[0];
    if (action.type !== 'overflow') {
      throw new Error(
        `archiveAllHandler received non-button action for user ${body.user.id}`,
      );
    }
    let actionName = '';
    let sectionId = '';
    try {
      const { id, actionType } = JSON.parse(action.selected_option.value);
      actionName = actionType;
      sectionId = id;
      switch (actionType) {
        case DigestAction.MarkAllAsRead:
          await markAllAsRead({ logger, body }, eventsEmitter, id);
          break;
        case DigestAction.ArchiveAll:
          await archiveAll({ logger, body }, eventsEmitter, id);
          break;
      }
      analyticsManager.gmailSectionAction({
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: actionName,
        extraParams: {
          sectionId,
        },
      });
    } catch (e) {
      logger.error(
        `error in sectionActionsHandler for user ${body.user.id}`,
        e,
      );
      eventsEmitter.emit(DISPLAY_ERROR_MODAL_EVENT_NAME, {
        triggerId: body.trigger_id,
        slackUserId: body.user.id,
        slackTeamId: body.team?.id || '',
        action: actionName,
      } as IMailErrorMetaData);
      throw e;
    }
  };
