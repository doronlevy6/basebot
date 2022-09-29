import { addToChannelInstructions } from '../slack/add-to-channel';
import { UserLink } from '../slack/components/user-link';
import { Summary } from '../slack/components/summary';
import { SlackSlashCommandWrapper } from '../slack/types';
import {
  /*enrichWithReplies,*/ parseMessagesForSummary,
  sortSlackMessages,
} from './utils';
import { SlackMessage } from './types';
import { ThreadSummaryModel } from './models/thread-summary.model';
import { AnalyticsManager } from '../analytics/manager';
import { Routes } from '../routes/router';
import { privateChannelInstructions } from '../slack/private-channel';

const MAX_MESSAGES_TO_FETCH = 100;

export const channelSummarizationHandler =
  (
    threadSummaryModel: ThreadSummaryModel,
    analyticsManager: AnalyticsManager,
  ) =>
  async ({
    ack,
    client,
    logger,
    payload,
    respond,
  }: SlackSlashCommandWrapper) => {
    try {
      await ack();

      const { channel_id, user_id, channel_name, team_id } = payload;

      logger.info(
        `${user_id} requested a channel summarization on ${channel_name}`,
      );

      analyticsManager.channelSummaryFunnel({
        funnelStep: 'user_requested',
        slackTeamId: team_id,
        slackUserId: user_id,
        channelId: channel_id,
      });

      const { ok, error, messages } = await client.conversations.history({
        channel: channel_id,
        limit: MAX_MESSAGES_TO_FETCH,
      });

      if (error || !ok || !messages) {
        throw new Error(
          `conversation history error: ${error} ${ok} ${messages}`,
        );
      }

      // Ensure that we sort the messages oldest first (so that the model receives a conversation in order)
      messages.sort(sortSlackMessages);

      // TODO: Return messages with replies when we bring in the full channel summary.
      // Since we want to return this in the coming days I'm going to leave it commented out for now.
      // const messagesWithReplies = await enrichWithReplies(
      //   channel_id,
      //   messages,
      //   client,
      // );
      const flattenArray: SlackMessage[] = messages.map((m) => m);
      // messagesWithReplies.forEach((item) =>
      //   flattenArray.push(...[item.message, ...item.replies]),
      // );

      const { messages: messagesTexts, users } = await parseMessagesForSummary(
        flattenArray,
        client,
      );

      // logger.info(
      //   `Attempting to summarize channel with ${messages.length} messages (${messagesTexts.length} with replies) and ${users.length} users`,
      // );
      logger.info(
        `Attempting to summarize channel with ${messagesTexts.length} messages and ${users.length} users`,
      );

      analyticsManager.channelSummaryFunnel({
        funnelStep: 'requesting_from_api',
        slackTeamId: team_id,
        slackUserId: user_id,
        channelId: channel_id,
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
        user_id,
      );

      if (!summary.length) {
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
          summary: summary,
        }),
      });

      analyticsManager.channelSummaryFunnel({
        funnelStep: 'summarized',
        slackTeamId: team_id,
        slackUserId: user_id,
        channelId: channel_id,
        extraParams: {
          numberOfMessages: messagesTexts.length,
          numberOfUsers: users.length,
          numberOfUniqueUsers: new Set(users).size,
        },
      });
    } catch (error) {
      logger.error(`error in channel summarization: ${error.stack}`);

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
