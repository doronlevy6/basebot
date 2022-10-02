import { SlackShortcutWrapper } from '../slack/types';
import { addToChannelInstructions } from '../slack/add-to-channel';
import { UserLink } from '../slack/components/user-link';
import { Summary } from '../slack/components/summary';
import { ThreadSummaryModel } from './models/thread-summary.model';
import { SlackMessage } from './types';
import { filterUnwantedMessages, parseMessagesForSummary } from './utils';
import { AnalyticsManager } from '../analytics/manager';
import { Routes } from '../routes/router';
import { privateChannelInstructions } from '../slack/private-channel';
import { ModerationError } from './errors/moderation-error';

export const threadSummarizationHandler =
  (
    analyticsManager: AnalyticsManager,
    threadSummaryModel: ThreadSummaryModel,
  ) =>
  async ({
    shortcut,
    ack,
    client,
    logger,
    payload,
    respond,
    context,
  }: SlackShortcutWrapper) => {
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
          ...messageRepliesRes.messages.filter((m) => {
            if (m.ts === messageTs) {
              return false;
            }

            return filterUnwantedMessages(m, context.botId);
          }),
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
        context.botId,
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
        blocks: Summary({
          actionId: Routes.THREAD_SUMMARY_FEEDBACK,
          basicText: basicText,
          summary: summary,
        }),
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
        await addToChannelInstructions(
          client,
          shortcut.trigger_id,
          {
            channelId: payload.channel.id,
            channelName: payload.channel.name,
            currentUser: payload.user.id,
            teamId: payload.user.team_id || 'unknown',
          },
          analyticsManager,
        );
        analyticsManager.threadSummaryFunnel({
          funnelStep: 'not_in_channel',
          slackTeamId: payload.team?.id || 'unknown',
          slackUserId: payload.user.id,
          channelId: payload.channel.id,
          threadTs: payload.message_ts,
        });
        return;
      }

      if (
        (error as Error).message.toLowerCase().includes('channel_not_found') ||
        (error as Error).message.toLowerCase().includes('missing_scope')
      ) {
        await privateChannelInstructions(
          client,
          payload.trigger_id,
          {
            channelId: payload.channel.id,
            channelName: payload.channel.name,
            currentUser: payload.user.id,
            teamId: payload.user.team_id || 'unknown',
          },
          analyticsManager,
        );
        analyticsManager.threadSummaryFunnel({
          funnelStep: 'private_channel',
          slackTeamId: payload.team?.id || 'unknown',
          slackUserId: payload.user.id,
          channelId: payload.channel.id,
          threadTs: payload.message_ts,
        });
        return;
      }

      if (error instanceof ModerationError) {
        await respond({
          response_type: 'ephemeral',
          text: "This summary seems to be inappropriate :speak_no_evil:\nI'm not able to help you in this case.",
        });

        analyticsManager.threadSummaryFunnel({
          funnelStep: 'moderated',
          slackTeamId: payload.team?.id || 'unknown',
          slackUserId: payload.user.id,
          channelId: payload.channel.id,
          threadTs: payload.message_ts,
        });
        return;
      }

      await client.chat.postEphemeral({
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
