import axios from 'axios';
import { addToChannelInstructions } from '../slack/add-to-channel';
import { UserLink } from '../slack/components/user-link';
import { SlackActionWrapper } from '../slack/types';
import { SlackMessage } from './types';
import { parseMessagesForSummary } from './utils';

export const threadSummarizationHandler = async ({
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
    const messageReplies: SlackMessage[] = [];

    if (!payload.message.user && !payload.message['bot_id']) {
      throw new Error('cannot extract user from empty user');
    }

    logger.info(
      `${shortcut.user.id} requested a thread summarization on ${payload.message.ts} in channel ${payload.channel.id}`,
    );

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

    const modelRes = await axios.post(
      process.env.THREAD_SUMMARY_MODEL_URL as string,
      {
        messages: messagesTexts,
        names: users,
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
    logger.error(`error in thread summarization: ${error.stack}`);

    if ((error as Error).message.toLowerCase().includes('not_in_channel')) {
      await addToChannelInstructions(client, shortcut.trigger_id, {
        channelId: payload.channel.id,
        channelName: payload.channel.name,
        currentUser: payload.user.id,
      });
      return;
    }

    await client.chat.postMessage({
      channel: shortcut.user.id,
      text: `We had an error processing the summarization: ${error.message}`,
      thread_ts: payload.message_ts,
      user: shortcut.user.id,
    });
  }
};
