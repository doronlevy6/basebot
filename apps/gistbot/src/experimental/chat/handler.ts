import { AnalyticsManager } from '@base/gistbot-shared';
import { SlashCommand } from '@slack/bolt';
import { SlackSlashCommandWrapper } from '../../slack/types';
import { ChatModel } from './chat.model';

export const chatHandler =
  (analyticsManager: AnalyticsManager, chatModel: ChatModel) =>
  async ({ ack, logger, body, client }: SlackSlashCommandWrapper) => {
    try {
      await ack();

      const teamId = (body as SlashCommand).team_id ?? body.team?.id;
      const userId = (body as SlashCommand).user_id ?? body.user?.id;
      const channelId = (body as SlashCommand).channel_id ?? body.channel?.id;
      if (!teamId || !userId || !channelId) {
        logger.error(
          `no teamId or userId in handler for chat handler ${JSON.stringify(
            body,
          )}`,
        );
        return;
      }

      const { messages } = await client.conversations.history({
        channel: channelId,
      });

      const relatedMessages = messages
        ?.filter((m) => Date.now() / 1000 - Number(m.ts) <= 180)
        .sort((a, b) => Number(a.ts) - Number(b.ts));

      if (relatedMessages?.length === 0) {
        logger.info("No messages found, can't do shit");
        await client.chat.postMessage({
          channel: channelId,
          text: "I only read messages from the last 3 minutes, haven't seen any here :eyes:",
        });

        return;
      }

      logger.info(`Got ${relatedMessages?.length} messages`);

      const start = 'James:\nI am a human\n\nBot:\nI am a bot\n\n';

      const prompt = relatedMessages?.map((m) => {
        const username = m.bot_profile ? 'Bot' : 'James';
        return `${username}:\n${m.text}\n\n`;
      });
      const end = 'Bot:\n';

      logger.info(`${start}${prompt}${end}`);

      const res = await chatModel.customModel(
        `${start}${prompt}${end}`,
        userId,
      );

      await client.chat.postMessage({
        channel: channelId,
        text: res,
      });
    } catch (err) {
      logger.error(`schedule settings load error: ${err} ${err.stack}`);
      await client.chat.postMessage({
        channel: body.channel_id,
        text: "Whoops, something ain't right :cry:",
      });
    }
  };
