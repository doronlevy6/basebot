import { logger } from '@base/logger';
import { BlockButtonWrapper } from '../../../common/types';
import { AnalyticsManager } from '../../analytics/analytics-manager';
import { SlackBotRoutes } from '../../routes/router';
import { IModalMetadata } from '../types';

export const AddLinkModal =
  () =>
  async ({ ack, client, body }: BlockButtonWrapper) => {
    try {
      await ack();

      const { message, channel } = body;
      if (!message?.ts || !channel?.id) {
        logger.error({
          msg: "Can't opening add link modal with out id or channel",
          body,
        });
        return;
      }

      const { organizationId, assigneeId, taskId } = JSON.parse(
        body?.actions[0]?.value,
      );

      logger.info(
        `handling task status modal for [${taskId}], assignee [${assigneeId}] `,
      );

      const metadata: IModalMetadata = {
        messageTs: message.ts,
        channelId: channel.id,
        organizationId,
        assigneeId,
        taskId,
      };

      // TODO: get task status and render the status

      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          private_metadata: JSON.stringify(metadata),
          type: 'modal',
          callback_id: SlackBotRoutes.ADD_TASK_LINK,
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
            text: 'Add a link',
            emoji: true,
          },
          blocks: [
            {
              block_id: 'link',
              type: 'input',
              element: {
                type: 'plain_text_input',
                action_id: SlackBotRoutes.ADD_TASK_LINK,
              },
              label: {
                type: 'plain_text',
                text: 'Enter a link to a relevant asset or ticket where the task is managed',
                emoji: true,
              },
            },
          ],
        },
      });

      AnalyticsManager.getInstance().modalView('add_link', assigneeId, {
        taskId,
      });
    } catch (error) {
      logger.error(error);
    }
  };
