import { logger } from '@base/logger';
import { SlackbotApiApi } from '@base/oapigen';
import { ViewAction } from '../../../common/types';
import { ADD_DISCUSSION_TASK_ID, IAddDiscussionPrivateMetadata } from './types';

export const addDiscussionHandler =
  (baseApi: SlackbotApiApi) => async (params: ViewAction) => {
    const { body, ack, view, client } = params;

    try {
      await ack();

      const taskId =
        Object.values(body.view.state.values)[0][ADD_DISCUSSION_TASK_ID]
          .selected_option?.value || '';

      const { messageTs, channelId, rawText, messageCreatorId, teamId } =
        JSON.parse(view.private_metadata) as IAddDiscussionPrivateMetadata;

      const user = await client.users.profile.get({ user: messageCreatorId });
      if (!user.profile?.email) {
        logger.warn(`unable to submit a new discussion without user profile`);
        return;
      }

      await baseApi.slackbotApiControllerAddDiscussion({
        creatorEmail: user.profile.email,
        externalId: `${teamId}:${channelId}:${messageTs}`,
        rawText,
        taskId,
      });
    } catch (err) {
      // TODO: update modal view with error
      logger.error(`Failed loading task status update modal: ${err}`);
    }
  };
