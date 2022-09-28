import { SlackShortcutWrapper } from '../slack/types';
import { addToChannelInstructions } from '../slack/add-to-channel';
import { UserLink } from '../slack/components/user-link';
import { ThreadSummaryModel } from './models/thread-summary.model';
import { SlackMessage } from './types';
import { parseMessagesForSummary } from './utils';
import { AnalyticsManager } from '../analytics/manager';
import { Routes } from '../routes/router';

export const threadSummarizationHandler =
  (
    analyticsManager: AnalyticsManager,
    threadSummaryModel: ThreadSummaryModel,
  ) =>
  async ({ shortcut, ack, client, logger, payload }: SlackShortcutWrapper) => {
    try {
      await ack();

      const messageTs = payload.message.ts;
      const channelId = payload.channel.id;
      const messageReplies: SlackMessage[] = [];

      if (!payload.message.user && !payload.message['bot_id']) {
        throw new Error('cannot extract user from empty user');
      }

      logger.info(
        `${shortcut.user.id} requested a thread summarization on ${payload.message.ts} in channel ${payload.channel.id}`,
      );
      analyticsManager.threadSummaryFunnel({
        funnelStep: 'user_requested',
        slackTeamId: payload.team?.id || 'unknown',
        slackUserId: payload.user.id,
        channelId: payload.channel.id,
        threadTs: payload.message_ts,
      });

      // eslint-disable-next-line no-constant-condition
      while (true) {
        let cursor = '';
        const messageRepliesRes = await client.conversations.replies({
          channel: channelId,
          ts: messageTs,
          limit: 200,
          cursor: cursor,
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

        messageReplies.push(
          ...messageRepliesRes.messages.filter((m) => m.ts !== messageTs),
        );

        if (!messageRepliesRes.has_more) {
          break;
        }

        if (!messageRepliesRes.response_metadata?.next_cursor) {
          break;
        }
        cursor = messageRepliesRes.response_metadata.next_cursor;
      }

      const { messages: messagesTexts, users } = await parseMessagesForSummary(
        [payload.message, ...messageReplies],
        client,
      );

      logger.info(
        `Attempting to summarize thread with ${messagesTexts.length} messages and ${users.length} users`,
      );

      analyticsManager.threadSummaryFunnel({
        funnelStep: 'requesting_from_api',
        slackTeamId: payload.team?.id || 'unknown',
        slackUserId: payload.user.id,
        channelId: payload.channel.id,
        threadTs: payload.message_ts,
        extraParams: {
          numberOfMessages: messagesTexts.length,
          numberOfUsers: users.length,
          numberOfUniqueUsers: new Set(users).size,
        },
      });

      const summary = await threadSummaryModel.summarizeThread(
        {
          messages: messagesTexts,
          names: users,
          titles: [], // TODO: Add user titles
        },
        payload.user.id,
      );

      const basicText = `${UserLink(
        shortcut.user.id,
      )} requested a summary for this thread:`;
      await client.chat.postMessage({
        channel: shortcut.channel.id,
        text: basicText,
        thread_ts: payload.message_ts,
        user: shortcut.user.id,
        blocks: [
          {
            type: 'section',
            text: {
              text: basicText,
              type: 'mrkdwn',
              verbatim: true,
            },
          },
          {
            type: 'section',
            text: {
              text: summary,
              type: 'plain_text',
              emoji: true,
            },
          },
          {
            type: 'divider',
          },
          {
            type: 'section',
            text: {
              type: 'plain_text',
              text: 'How was this summary?',
            },
            accessory: {
              type: 'static_select',
              placeholder: {
                type: 'plain_text',
                text: 'Feedback',
                emoji: true,
              },
              options: [
                {
                  text: {
                    type: 'plain_text',
                    text: 'Amazing summary, great job!',
                    emoji: true,
                  },
                  value: 'amazing',
                },
                {
                  text: {
                    type: 'plain_text',
                    text: 'Summary was OK',
                    emoji: true,
                  },
                  value: 'ok',
                },
                {
                  text: {
                    type: 'plain_text',
                    text: "Summary wasn't relevant",
                    emoji: true,
                  },
                  value: 'not_relevant',
                },
                {
                  text: {
                    type: 'plain_text',
                    text: 'Summary was incorrect',
                    emoji: true,
                  },
                  value: 'incorrect',
                },
                {
                  text: {
                    type: 'plain_text',
                    text: 'Summary was inappropriate',
                    emoji: true,
                  },
                  value: 'inappropriate',
                },
              ],
              action_id: Routes.THREAD_SUMMARY_FEEDBACK,
            },
          },
        ],
      });

      analyticsManager.threadSummaryFunnel({
        funnelStep: 'summarized',
        slackTeamId: payload.team?.id || 'unknown',
        slackUserId: payload.user.id,
        channelId: payload.channel.id,
        threadTs: payload.message_ts,
        extraParams: {
          numberOfMessages: messagesTexts.length,
          numberOfUsers: users.length,
          numberOfUniqueUsers: new Set(users).size,
        },
      });
    } catch (error) {
      logger.error(`error in thread summarization: ${error.stack}`);

      if ((error as Error).message.toLowerCase().includes('not_in_channel')) {
        await addToChannelInstructions(client, shortcut.trigger_id, {
          channelId: payload.channel.id,
          channelName: payload.channel.name,
          currentUser: payload.user.id,
        });
        analyticsManager.threadSummaryFunnel({
          funnelStep: 'not_in_channel',
          slackTeamId: payload.team?.id || 'unknown',
          slackUserId: payload.user.id,
          channelId: payload.channel.id,
          threadTs: payload.message_ts,
        });
        return;
      }

      await client.chat.postMessage({
        channel: shortcut.user.id,
        text: `We had an error processing the summarization: ${error.message}`,
        thread_ts: payload.message_ts,
        user: shortcut.user.id,
      });

      analyticsManager.error({
        slackTeamId: payload.team?.id || 'unknown',
        slackUserId: payload.user.id,
        channelId: payload.channel.id,
        errorMessage: error.message,
        extraParams: {
          threadTs: payload.message_ts,
        },
      });
    }
  };
