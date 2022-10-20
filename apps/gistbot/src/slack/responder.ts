import { logger } from '@base/logger';
import { RespondFn } from '@slack/bolt';
import { Block, KnownBlock, WebClient } from '@slack/web-api';

interface RespondSpecificArgs {
  response_type?: 'in_channel' | 'ephemeral';
  replace_original?: boolean;
  delete_original?: boolean;
}

export const responder = async (
  respond: RespondFn | undefined,
  client: WebClient,
  text: string,
  blocks: (KnownBlock | Block)[] | undefined,
  channelId: string | undefined,
  userId: string,
  respondArgs: RespondSpecificArgs,
  threadTs?: string,
): Promise<void> => {
  let usedRespond = false;
  const { response_type, replace_original, delete_original } = respondArgs;
  const postEphemeral = response_type && response_type === 'ephemeral';

  try {
    if (respond) {
      usedRespond = true;
      await respond({
        response_type: response_type,
        replace_original: replace_original,
        delete_original: delete_original,
        text: text,
        blocks,
        thread_ts: threadTs,
      });
      return;
    }

    if (!channelId) {
      throw new Error('no respond function and no channel in props');
    }

    if (postEphemeral) {
      await client.chat.postEphemeral({
        text: text,
        blocks,
        channel: channelId,
        user: userId,
        thread_ts: threadTs,
      });
      return;
    }

    await client.chat.postMessage({
      text: text,
      blocks,
      channel: channelId,
      thread_ts: threadTs,
    });
  } catch (error) {
    logger.error(`error in responder: ${error} ${error.stack}`);
    if (!usedRespond || !channelId) {
      throw error;
    }
    // If we used the respond function, we retry with the client to see if we can find the actual error
    try {
      if (postEphemeral) {
        await client.chat.postEphemeral({
          text: text,
          blocks,
          channel: channelId,
          user: userId,
          thread_ts: threadTs,
        });

        // Make sure to still delete the original if we can
        if (delete_original && respond) {
          await respond({
            delete_original: true,
          });
        }

        return;
      }

      await client.chat.postMessage({
        text: text,
        blocks,
        channel: channelId,
        thread_ts: threadTs,
      });

      // Make sure to still delete the original if we can
      if (delete_original && respond) {
        await respond({
          delete_original: true,
        });
      }
    } catch (error) {
      logger.error(
        `error in responder after retry with client: ${error} ${error.stack}`,
      );
      throw error;
    }
  }
};
