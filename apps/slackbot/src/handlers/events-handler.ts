import { logger } from '@base/logger';
import { SlackbotApiApi as SlackbotApi } from '@base/oapigen';
import { ActionsBlock, SectionBlock } from '@slack/web-api';
import { Message } from '@slack/web-api/dist/response/ConversationsRepliesResponse';
import axios from 'axios';
import {
  BlockButtonWrapper,
  SlackActionWrapper,
  ViewAction,
} from '../../../slackbot/common/types';
import { AnalyticsManager } from '../analytics/analytics-manager';
import { AcknowledgementStatus } from '../tasks/view/types';
import { UserLink } from '../tasks/view/user-link';
import { updateTaskAndSendEvent } from './update-task-message';

export class EventsHandler {
  private baseApi: SlackbotApi;

  constructor(baseApi: SlackbotApi) {
    this.baseApi = baseApi;
  }

  handleTaskAcknowledge = async (params: BlockButtonWrapper) => {
    const { body, ack, say } = params;
    await ack();

    try {
      const { organizationId, assigneeId, taskId, actionId } = JSON.parse(
        body?.actions[0]?.value,
      );
      logger.info(
        `handling task ack for task [${taskId}], assignee [${assigneeId}], status [${actionId}] `,
      );

      const status =
        actionId === AcknowledgementStatus.Declined
          ? AcknowledgementStatus.Declined
          : AcknowledgementStatus.Acknowledged;

      const res = await this.baseApi.slackbotApiControllerAcknowledgeTask({
        userId: assigneeId,
        organizationId,
        taskId,
        acknowledged: status === AcknowledgementStatus.Acknowledged,
      });

      if (!res.data.task) {
        logger.error(`unable to find task with id [${taskId}]`);
        return;
      }

      const { message, channel } = body;
      if (!message || !channel) {
        logger.error("Can't update slack message with out id or channel");
        return;
      }

      await updateTaskAndSendEvent(
        params,
        {
          assigneeId,
          task: res.data.task,
          organizationId,
          channelId: channel.id,
          messageTs: message.ts,
        },
        { action: 'task_acknowledged' },
        { acknowledgementStatus: actionId as AcknowledgementStatus },
      );
    } catch (e) {
      logger.error({
        msg: `error in changing acknowledgement for task`,
        error: e,
      });
      say(`Error in acknowledging task`);
    }
  };

  handleCreateTask = async ({
    shortcut,
    ack,
    client,
    logger,
    payload,
  }: SlackActionWrapper) => {
    try {
      await ack();
      await client.views.open({
        trigger_id: shortcut.trigger_id,
        view: {
          private_metadata: payload.message.text,
          callback_id: 'create-tasks-submit',
          type: 'modal',
          title: {
            type: 'plain_text',
            text: 'Create tasks at base',
          },
          close: {
            type: 'plain_text',
            text: 'Close',
          },
          submit: { type: 'plain_text', text: 'Create tasks' },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Tap "Create tasks" and a draft will be waiting for you in the Base app for review\n\n',
              },
            },
          ],
        },
      });
    } catch (error) {
      logger.error(error);
    }
  };
  submitCreateTasks = async ({ ack, body, payload, client }: ViewAction) => {
    try {
      await ack();
      const user = await client.users.profile.get({ user: body.user.id });
      if (!user.profile?.email) {
        logger.warn(`unable to submit a new task without user profile`);
        return;
      }

      const userEMail = user.profile.email;
      const text = payload.private_metadata;
      const res =
        await this.baseApi.slackbotApiControllerCreateTasksFromSlackMessage({
          email: userEMail,
          text: text,
        });
      AnalyticsManager.getInstance().userCreateDraft(user.profile.email);

      const button: ActionsBlock = {
        type: 'actions',
        elements: [
          {
            type: 'button',
            style: 'primary',
            text: {
              type: 'plain_text',
              text: 'Open The App',
              emoji: true,
            },
            value: 'click_to_open_app',
            url: 'https://link.base.la/drafts',
            action_id: 'click-to-open-app-action',
          },
        ],
      };

      const textMessage = `We've created a task for you in the system, check out the base app to see all of your tasks!`;

      const section: SectionBlock = {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: textMessage,
        },
      };

      if (res.status >= 200 && res.status <= 299) {
        await client.chat.postMessage({
          channel: body.user.id,
          text: textMessage,
          blocks: [section, button],
        });
      }
    } catch (e) {
      logger.error(e);
    }
  };

  handleSummarizeThread = async ({
    shortcut,
    ack,
    client,
    logger,
    payload,
  }: SlackActionWrapper) => {
    try {
      await ack();

      const messageTs = payload.message.ts;
      const channelId = payload.channel.id;
      const messageReplies: Message[] = [];

      if (!payload.message.user && !payload.message['bot_id']) {
        throw new Error('cannot extract user from empty user');
      }

      logger.info(
        `${shortcut.user.id} requested a thread summarization on ${payload.message.ts} in channel ${payload.channel.id}`,
      );

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const messageRepliesRes = await client.conversations.replies({
          channel: channelId,
          ts: messageTs,
          limit: 200,
        });

        if (messageRepliesRes.error) {
          throw new Error(`message replies error: ${messageRepliesRes.error}`);
        }
        if (!messageRepliesRes.ok) {
          throw new Error('message replies not ok');
        }

        if (!messageRepliesRes.messages) {
          break;
        }

        messageReplies.push(...messageRepliesRes.messages);

        if (!messageRepliesRes.has_more) {
          break;
        }
      }

      const messagesWithText: (
        | Message
        | {
            type: 'message';
            user?: string;
            ts: string;
            text?: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [key: string]: any;
          }
      )[] = [payload.message, ...messageReplies].filter((t) => t.text);

      const messagesTexts: string[] = messagesWithText.map(
        (m) => m.text,
      ) as string[];

      const messageUserIds: string[] = [
        ...new Set(messagesWithText.map((m) => m.user)),
      ].filter((u) => u) as string[];

      const messageBotIds: string[] = [
        ...new Set(messagesWithText.map((m) => m.bot_id)),
      ].filter((u) => u) as string[];

      const userInfoReses = await Promise.all(
        messageUserIds.map((u) => client.users.info({ user: u })),
      );

      const botInfoReses = await Promise.all(
        messageBotIds.map((u) => client.bots.info({ bot: u })),
      );

      const userNames = messagesWithText.map((m) => {
        const userInfo = userInfoReses.find((uir) => {
          if (uir.error) {
            throw new Error(`message user error: ${uir.error}`);
          }
          if (!uir.ok || !uir.user) {
            throw new Error('message user not ok');
          }

          return uir.user.id === m.user;
        });
        if (userInfo && userInfo.user) {
          return userInfo.user.name;
        }

        const botInfo = botInfoReses.find((uir) => {
          if (uir.error) {
            throw new Error(`message bot user error: ${uir.error}`);
          }
          if (!uir.ok || !uir.bot) {
            throw new Error('message bot user not ok');
          }

          return uir.bot.id === m.bot_id;
        });

        if (!botInfo || !botInfo.bot) {
          throw new Error(
            `no user information or bot information found for user ${
              m.user || m.bot_id
            }`,
          );
        }

        return botInfo.bot.name;
      }) as string[];

      logger.info(
        `Attempting to summarize thread with ${messagesTexts.length} messages and ${userNames.length} users`,
      );

      const modelRes = await axios.post(
        process.env.THREAD_SUMMARY_MODEL_URL as string,
        {
          messages: messagesTexts,
          names: userNames,
        },
        {
          timeout: 60000,
        },
      );

      if (modelRes.status >= 200 && modelRes.status <= 299) {
        await client.chat.postMessage({
          channel: shortcut.channel.id,
          text: `${UserLink(
            shortcut.user.id,
          )} requested a summary for this thread:\n\n${modelRes.data['data']}`,
          thread_ts: payload.message_ts,
          user: shortcut.user.id,
        });
      }
    } catch (error) {
      logger.error(error);
      await client.chat.postMessage({
        channel: shortcut.user.id,
        text: `We had an error processing the summarization: ${error.message}`,
        thread_ts: payload.message_ts,
        user: shortcut.user.id,
      });
    }
  };
}
