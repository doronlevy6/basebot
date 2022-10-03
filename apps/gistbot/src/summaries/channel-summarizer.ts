import { addToChannelInstructions } from '../slack/add-to-channel';
import { UserLink } from '../slack/components/user-link';
import { Summary } from '../slack/components/summary';
import { SlackSlashCommandWrapper } from '../slack/types';
import {
  filterUnwantedMessages,
  identifyTriggeringUser,
  enrichWithReplies,
  parseThreadForSummary,
  sortSlackMessages,
} from './utils';
import { AnalyticsManager } from '../analytics/manager';
import { Routes } from '../routes/router';
import { privateChannelInstructions } from '../slack/private-channel';
import { ModerationError } from './errors/moderation-error';
import { ChannelSummaryModel } from './models/channel-summary.model';
import {
  approximatePromptCharacterCountForChannelSummary,
  MAX_PROMPT_CHARACTER_COUNT,
} from './models/prompt-character-calculator';
import { WebClient } from '@slack/web-api';
import { Context } from '@slack/bolt';
import { SlackMessage } from './types';

const MAX_MESSAGES_TO_FETCH = 50;

export const channelSummarizationHandler =
  (
    channelSummaryModel: ChannelSummaryModel,
    analyticsManager: AnalyticsManager,
  ) =>
  async ({
    ack,
    client,
    logger,
    payload,
    respond,
    context,
  }: SlackSlashCommandWrapper) => {
    try {
      await ack();

      const { channel_id, user_id, channel_name, team_id } = payload;

      // Don't await so that we don't force anything to wait just for the identification.
      // This handles error handling internally and will never cause an exception, so we
      // won't have any unhandled promise rejection errors.
      identifyTriggeringUser(user_id, team_id, client, analyticsManager);

      logger.info(
        `${user_id} requested a channel summarization on ${channel_name}`,
      );

      analyticsManager.channelSummaryFunnel({
        funnelStep: 'user_requested',
        slackTeamId: team_id,
        slackUserId: user_id,
        channelId: channel_id,
      });

      const rootMessages = await fetchChannelRootMessages(
        client,
        channel_id,
        context,
        MAX_MESSAGES_TO_FETCH,
      );

      // Ensure that we sort the messages oldest first (so that the model receives a conversation in order)
      rootMessages.sort(sortSlackMessages);

      const messagesWithReplies = await enrichWithReplies(
        channel_id,
        rootMessages,
        client,
        context.botId,
      );

      const threads = await Promise.all(
        messagesWithReplies.map((mwr) => {
          const thread = parseThreadForSummary(
            [mwr.message, ...mwr.replies],
            client,
            payload.team_id,
            MAX_PROMPT_CHARACTER_COUNT,
            context.botId,
          );

          return thread;
        }),
      );

      const numberOfMessages = threads.reduce((acc, t) => {
        return acc + t.messages.length;
      }, 0);
      const numberOfUsers = threads.reduce((acc, t) => {
        return acc + t.users.length;
      }, 0);
      const uniqueUsers = threads.reduce((acc, t) => {
        t.users.forEach((u) => acc.add(u));
        return acc;
      }, new Set<string>());

      let successfulSummary = '';
      let analyticsPrefix = '';
      // eslint-disable-next-line no-constant-condition
      while (true) {
        logger.info(
          `Attempting to summarize channel with ${threads.length} threads, ${numberOfMessages} messages, and ${numberOfUsers} users`,
        );

        analyticsManager.channelSummaryFunnel({
          funnelStep: `${analyticsPrefix}requesting_from_api`,
          slackTeamId: team_id,
          slackUserId: user_id,
          channelId: channel_id,
          extraParams: {
            numberOfThreads: threads.length,
            numberOfMessages: numberOfMessages,
            numberOfUsers: numberOfUsers,
            numberOfUniqueUsers: uniqueUsers.size,
          },
        });

        let req = {
          channel_name: channel_name,
          threads: threads.map((t) => {
            return {
              messages: t.messages,
              names: t.users,
              titles: t.titles,
            };
          }),
        };
        let cc = approximatePromptCharacterCountForChannelSummary(req);
        while (cc > MAX_PROMPT_CHARACTER_COUNT) {
          threads.shift();
          req = {
            channel_name: channel_name,
            threads: threads.map((t) => {
              return {
                messages: t.messages,
                names: t.users,
                titles: t.titles,
              };
            }),
          };
          cc = approximatePromptCharacterCountForChannelSummary(req);
        }

        const summary = await channelSummaryModel.summarizeChannel(
          req,
          user_id,
        );

        if (summary.length) {
          successfulSummary = summary;
          break;
        }

        analyticsPrefix = 'redo_';
        threads.shift();
        if (threads.length === 0) {
          break;
        }
      }

      if (!successfulSummary.length) {
        throw new Error('Invalid response');
      }

      const basicText = `${UserLink(
        user_id,
      )} here's the summary you requested:`;

      await respond({
        text: basicText,
        blocks: Summary({
          actionId: Routes.CHANNEL_SUMMARY_FEEDBACK,
          basicText: basicText,
          summary: successfulSummary,
        }),
      });

      analyticsManager.channelSummaryFunnel({
        funnelStep: 'summarized',
        slackTeamId: team_id,
        slackUserId: user_id,
        channelId: channel_id,
        extraParams: {
          numberOfThreads: threads.length,
          numberOfMessages: numberOfMessages,
          numberOfUsers: numberOfUsers,
          numberOfUniqueUsers: uniqueUsers.size,
        },
      });
    } catch (error) {
      logger.error(`error in channel summarization: ${error} ${error.stack}`);

      if ((error as Error).message.toLowerCase().includes('not_in_channel')) {
        await addToChannelInstructions(
          client,
          payload.trigger_id,
          {
            channelId: payload.channel_id,
            channelName: payload.channel_name,
            currentUser: payload.user_id,
            teamId: payload.team_id,
          },
          analyticsManager,
        );
        analyticsManager.channelSummaryFunnel({
          funnelStep: 'not_in_channel',
          slackTeamId: payload.team_id,
          slackUserId: payload.user_id,
          channelId: payload.channel_id,
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
            channelId: payload.channel_id,
            channelName: payload.channel_name,
            currentUser: payload.user_id,
            teamId: payload.team_id,
          },
          analyticsManager,
        );
        analyticsManager.channelSummaryFunnel({
          funnelStep: 'private_channel',
          slackTeamId: payload.team_id,
          slackUserId: payload.user_id,
          channelId: payload.channel_id,
        });
        return;
      }

      if (error instanceof ModerationError) {
        await respond({
          response_type: 'ephemeral',
          text: "This summary seems to be inappropriate :speak_no_evil:\nI'm not able to help you in this case.",
        });

        analyticsManager.channelSummaryFunnel({
          funnelStep: 'moderated',
          slackTeamId: payload.team_id,
          slackUserId: payload.user_id,
          channelId: payload.channel_id,
        });
        return;
      }

      await respond({
        response_type: 'ephemeral',
        text: `We had an error processing the summarization: ${error.message}`,
      });

      analyticsManager.error({
        slackTeamId: payload.team_id,
        slackUserId: payload.user_id,
        channelId: payload.channel_id,
        errorMessage: error.message,
      });
    }
  };

const fetchChannelRootMessages = async (
  client: WebClient,
  channel_id: string,
  context: Context,
  maximumMessageCount: number,
): Promise<SlackMessage[]> => {
  const output: SlackMessage[] = [];
  let cursor = '';

  while (output.length < maximumMessageCount) {
    const { ok, error, messages, has_more, response_metadata } =
      await client.conversations.history({
        channel: channel_id,
        limit: maximumMessageCount - output.length,
        cursor: cursor,
      });

    if (error || !ok) {
      throw new Error(`conversation history error: ${error} ${ok}`);
    }

    if (!messages) {
      break;
    }

    const filteredMessages = messages.filter((m) => {
      // conversations.history returns some messages in threads
      // and since we are going to fetch the replies anyways, we should
      // remove these from the roots.
      if (m.thread_ts && m.ts !== m.thread_ts) {
        return false;
      }

      return filterUnwantedMessages(m, context.botId);
    });

    output.push(...filteredMessages);

    cursor = response_metadata?.next_cursor || '';
    if (!has_more || cursor === '') {
      break;
    }
  }

  return output;
};
