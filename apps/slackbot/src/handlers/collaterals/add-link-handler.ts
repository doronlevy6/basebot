import { logger } from '@base/logger';
import { SlackbotApiApi } from '@base/oapigen';
import validator from 'validator';
import { ViewAction } from '../../../common/types';
import { SlackBotRoutes } from '../../routes/router';
import { updateTaskAndSendEvent } from '../update-task-message';
import { tryDetectLinkUrl } from './link-detector';
import { showOauthModalIfNeeded } from './oauth-modal';

export const addLinkHandler =
  (baseApi: SlackbotApiApi) => async (params: ViewAction) => {
    const { body, ack, view, client } = params;

    try {
      const { organizationId, assigneeId, taskId, messageTs, channelId } =
        JSON.parse(view.private_metadata);

      const linkUrl = Object.values(body.view.state.values)[0][
        SlackBotRoutes.ADD_TASK_LINK
      ].value;

      const linkComment =
        Object.values(body.view.state.values)[1][
          SlackBotRoutes.ADD_TASK_LINK_COMMENT
        ].value || undefined; // Needs `|| undefined` because it comes back as null and we want it as undefined

      if (!linkUrl || !validator.isURL(linkUrl)) {
        logger.error(`invalid url in task link`);
        await ack({
          response_action: 'errors',
          errors: { link: 'Invalid URL' },
        });
        return;
      }

      await ack();

      logger.info(
        `handling adding task link for task [${taskId}], link [${linkUrl}], link comment: ${linkComment}`,
      );

      const res = await baseApi.slackbotApiControllerAddCollateral({
        taskId,
        url: linkUrl,
        userId: assigneeId,
        creatorComment: linkComment,
      });

      if (!res.data.task) {
        throw new Error(`unable to find task with id [${taskId}]`);
      }

      await updateTaskAndSendEvent(
        params,
        {
          organizationId,
          assigneeId,
          task: res.data.task,
          messageTs,
          channelId,
        },
        { action: 'status_update' },
        { extraCollaterals: [linkUrl] },
      );

      const provider = tryDetectLinkUrl(linkUrl);
      if (!provider) {
        logger.info(`Provider ${provider} not detected, no need to auth.`);
        return;
      }

      showOauthModalIfNeeded(
        {
          orgId: organizationId,
          provider,
          userId: assigneeId,
          triggerId: body.trigger_id,
        },
        client,
        baseApi,
      );
    } catch (err) {
      // TODO: update modal view with error
      logger.error(`Add link handler error: ${err}`);
    }
  };
