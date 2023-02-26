import { AnalyticsManager } from '@base/gistbot-shared';
import EventEmitter = require('events');
import { SlackBlockActionWrapper } from '../../slack/types';
import { DigestAction } from '../types';
import { archiveAll } from './archive-all';
import { markAllAsRead } from './mark-all-as-read';

export const sectionActionsHandler =
  (analyticsManager: AnalyticsManager, eventsEmitter: EventEmitter) =>
  async (props: SlackBlockActionWrapper) => {
    await props.ack();
    const action = props.body.actions[0];
    if (action.type !== 'overflow') {
      throw new Error(
        `archiveAllHandler received non-button action for user ${props.body.user.id}`,
      );
    }

    let isError = false;
    let actionName = '';
    let sectionId = '';
    try {
      const { id, actionType } = JSON.parse(action.selected_option.value);
      actionName = actionType;
      sectionId = id;
      switch (actionType) {
        case DigestAction.MarkAllAsRead:
          isError = await markAllAsRead(props, eventsEmitter, id);
          break;
        case DigestAction.ArchiveAll:
          isError = await archiveAll(props, eventsEmitter, id);
          break;
      }
    } catch (e) {
      isError = true;
      props.logger.error(
        `error in sectionActionsHandler for user ${props.body.user.id}, ${e}`,
      );
      // TODO: Show error modal
      throw e;
    } finally {
      analyticsManager.gmailSectionAction({
        slackUserId: props.body.user.id,
        slackTeamId: props.body.team?.id || '',
        action: actionName,
        extraParams: {
          isError,
          sectionId,
        },
      });
    }
  };
