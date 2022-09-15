import { logger } from '@base/logger';
import { SlackbotApiApi } from '@base/oapigen';
import { PlainTextOption } from '@slack/web-api';
import { SlackActionWrapper } from '../../../common/types';
import { SlackBotRoutes } from '../../routes/router';
import { ADD_DISCUSSION_TASK_ID, IAddDiscussionPrivateMetadata } from './types';

const MODAL_OPTION_MAX_CHARS = 75;

export const AddDiscussionModal =
  (baseApi: SlackbotApiApi) =>
  async ({ ack, client, body, shortcut }: SlackActionWrapper) => {
    try {
      await ack();

      const { message, channel, user, team } = body;
      logger.info(`Opening add discussoion modal for ${message.user}`);
      if (!message?.ts || !channel?.id || !message.text || !message.user) {
        logger.error({
          msg: "Can't open add discussion modal without id or channel",
          body,
        });
        return;
      }

      const userProfile = await client.users.profile.get({ user: user.id });
      if (!userProfile.profile?.email) {
        logger.warn(`unable to open modal without user profile ${user.id}`);
        return;
      }

      logger.info(
        `Getting tasks for discussions modal ${user.id} ${userProfile.profile.email}`,
      );

      const { data } = await baseApi.slackbotApiControllerGetTasks({
        userEmail: userProfile.profile.email,
      });

      if (!data.tasks.length) {
        logger.warn(
          `unable to open modal without tasks for ${userProfile.profile.email}`,
        );
        return;
      }

      logger.warn(`Got ${data.tasks.length} tasks`);

      const tasksOptions: PlainTextOption[] = data.tasks.map((task) => ({
        text: {
          type: 'plain_text',
          text: task.title.substring(0, MODAL_OPTION_MAX_CHARS),
          emoji: true,
        },
        value: task.id,
      }));

      const metadata: IAddDiscussionPrivateMetadata = {
        messageTs: message.ts,
        channelId: channel.id,
        teamId: team?.id,
        rawText: message.text,
        messageCreatorId: message.user,
        shortcutActorEmail: userProfile.profile.email,
      };

      await client.views.open({
        trigger_id: shortcut.trigger_id,
        view: {
          private_metadata: JSON.stringify(metadata),
          type: 'modal',
          callback_id: SlackBotRoutes.ADD_DISCUSSION_SUBMIT,
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
            text: 'Share in task',
            emoji: true,
          },
          blocks: [
            {
              type: 'input',
              block_id: 'task_id',
              element: {
                type: 'static_select',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select task',
                  emoji: true,
                },
                options: tasksOptions,
                action_id: ADD_DISCUSSION_TASK_ID,
              },
              label: {
                type: 'plain_text',
                text: ' ',
                emoji: true,
              },
            },
          ],
        },
      });
    } catch (error) {
      logger.error(error);
    }
  };
