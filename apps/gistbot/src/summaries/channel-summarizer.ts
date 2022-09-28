import { addToChannelInstructions } from '../slack/add-to-channel';
import { UserLink } from '../slack/components/user-link';
import { SlackSlashCommandWrapper } from '../slack/types';
import { enrichWithReplies, parseMessagesForSummary } from './utils';
import { SlackMessage } from './types';
import { ThreadSummaryModel } from './models/thread-summary.model';

const MAX_MESSAGES_TO_FETCH = 50;

export const channelSummarizationHandler =
  (threadSummaryModel: ThreadSummaryModel) =>
  async ({
    ack,
    client,
    logger,
    payload,
    respond,
  }: SlackSlashCommandWrapper) => {
    try {
      await ack();

      const { channel_id, user_id, channel_name } = payload;

      logger.info(
        `${user_id} requested a channel summarization on ${channel_name}`,
      );

      const { ok, error, messages } = await client.conversations.history({
        channel: channel_id,
        limit: MAX_MESSAGES_TO_FETCH,
      });

      if (error || !ok || !messages) {
        throw new Error(
          `conversation history error: ${error} ${ok} ${messages}`,
        );
      }

      const messagesWithReplies = await enrichWithReplies(
        channel_id,
        messages,
        client,
      );
      const flattenArray: SlackMessage[] = [];
      messagesWithReplies.forEach((item) =>
        flattenArray.push(...[item.message, ...item.replies]),
      );

      const { messages: messagesTexts, users } = await parseMessagesForSummary(
        flattenArray,
        client,
      );

      logger.info(
        `Attempting to summarize channel with ${messages.length} messages (${messagesTexts.length} with replies) and ${users.length} users`,
      );

      const summary = await threadSummaryModel.summarizeThread(
        {
          messages: messagesTexts,
          names: users,
          titles: [], // TODO: Add user titles
        },
        payload.user.id,
      );

      if (!summary.length) {
        throw new Error('Invalid response');
      }

      await respond({
        text: `${UserLink(
          user_id,
        )} here's the summary you requested:\n\n${summary}`,
      });
    } catch (error) {
      logger.error(`error in thread summarization: ${error.stack}`);

      if ((error as Error).message.toLowerCase().includes('not_in_channel')) {
        await addToChannelInstructions(client, payload.trigger_id, {
          channelId: payload.channel_id,
          channelName: payload.channel_name,
          currentUser: payload.user_id,
        });
        return;
      }

      await respond({
        response_type: 'ephemeral',
        text: `We had an error processing the summarization: ${error.message}`,
      });
    }
  };
