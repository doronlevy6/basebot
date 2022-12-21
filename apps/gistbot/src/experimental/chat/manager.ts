import { AnalyticsManager } from '@base/gistbot-shared';
import { Logger, WebClient } from '@slack/web-api';
import { Message } from '@slack/web-api/dist/response/ChannelsHistoryResponse';
import { extractMessageText } from '../../slack/message-text';
import { parseSlackMrkdwn } from '../../slack/parser';
import { getUserOrBotDetails } from '../../summaries/utils';
import { ChatModel } from './chat.model';
import { SlackDataStore } from '../../utils/slack-data-store';

const STOP_WORDS = ['stop', 'reset'];
const MAX_SESSION_DURATION_SEC = 5 * 60;

interface IProps {
  logger: Logger;
  client: WebClient;
  userId: string;
  channelId: string;
  teamId: string;
}

const ourBotName = 'theGist';

export class ChatManager {
  constructor(
    private chatModel: ChatModel,
    private analyticsManager: AnalyticsManager,
    private slackDataStore: SlackDataStore,
  ) {}

  async handleChatMessage(props: IProps) {
    const { channelId, client, logger, teamId, userId } = props;
    try {
      logger.debug(
        `Chat session running ${JSON.stringify({
          teamId,
          userId,
          channelId,
        })}}`,
      );

      if (!teamId || !userId || !channelId) {
        logger.error(
          `no teamId or userId in handler for chat handler ${JSON.stringify({
            teamId,
            userId,
            channelId,
          })}`,
        );
        return;
      }

      const { messages } = await client.conversations.history({
        channel: channelId,
      });

      if (!messages || !messages.length) {
        logger.error('Couldnt find messages in chat session');
        await client.chat.postMessage({
          channel: channelId,
          text: "Whoops, something ain't right :cry:",
        });
        return;
      }

      let relatedMessages = this.filterByTimeSession(messages as Message[]);
      relatedMessages = this.filterByStopWords(relatedMessages, logger);

      const isEmpty = relatedMessages.length === 0;
      if (isEmpty) {
        logger.info('all stopped');

        this.analyticsManager.chatMessage({
          slackTeamId: teamId,
          slackUserId: userId,
          channelId,
          type: 'reset',
        });

        return;
      }

      const enrichedMessages = await this.parseAndEnrichMessages(
        relatedMessages,
        teamId,
        client,
      );

      logger.debug(
        `chatGist loaded ${relatedMessages?.length} session messages`,
      );

      const names: { username: string; text: string; isBot: boolean }[] = [];
      enrichedMessages.forEach((msg) => (names[msg.username] = msg));
      const start = Object.values(names)
        .map((name) => {
          const isUs = name.username.toLowerCase().includes('gist');
          if (isUs) {
            return `${ourBotName}:\nI'm theGist bot, a bot which answers questions and writes code.\n\n`;
          }
          if (name.isBot) {
            return `${name}:\nI'm a bot`;
          }

          return `${name}:\nI'm a human`;
        })
        .join('\n\n');

      const prompt = enrichedMessages?.map((m) => {
        return `${m.username}:\n${m.text}\n\n`;
      });
      const end = `${ourBotName}:\n`;

      logger.debug(`Chat prompt:\n${start}${prompt}${end}`);

      const res = await this.chatModel.customModel(
        `${start}${prompt}${end}`,
        userId,
      );

      await client.chat.postMessage({
        channel: channelId,
        text: res,
      });

      this.analyticsManager.chatMessage({
        slackTeamId: teamId,
        slackUserId: userId,
        channelId,
        type: 'message',
        extraParams: {
          sessionSize: relatedMessages.length,
          totalLength: relatedMessages.reduce(
            (acc, m) => acc + (m.text?.length || 0),
            0,
          ),
        },
      });
    } catch (err) {
      logger.error(`chatGist handler error: ${err} ${err.stack}`);
      await client.chat.postMessage({
        channel: channelId,
        text: "Whoops, something ain't right :cry:",
      });
    }
  }

  private filterByStopWords(messages: Message[], logger: Logger) {
    let stopIndex = -1;
    messages?.forEach((m, i) => {
      if (STOP_WORDS.includes(m.text?.toLowerCase() || '')) {
        stopIndex = i;
      }
    });

    if (stopIndex !== -1) {
      logger.debug('Stop word found for chatGist');
    }

    return messages.filter((m, i) => stopIndex === undefined || i > stopIndex);
  }

  private filterByTimeSession(messages: Message[]) {
    return (
      messages
        ?.filter((m) => {
          const timeSinceNow = Date.now() / 1000 - Number(m.ts);
          return timeSinceNow <= MAX_SESSION_DURATION_SEC;
        })
        .sort((a, b) => Number(a.ts) - Number(b.ts)) || []
    );
  }

  private async parseAndEnrichMessages(
    messages: Message[],
    teamId: string,
    client: WebClient,
  ): Promise<{ username: string; text: string; isBot: boolean }[]> {
    const userOrBotIds = messages.map((m) => {
      return {
        is_bot: Boolean(m.bot_id),
        user_id: m.bot_id ? m.bot_id : m.user || '',
      };
    });
    const userOrBotDetails = await getUserOrBotDetails(
      [...new Set(userOrBotIds)],
      teamId,
      client,
    );

    const messageTexts = await Promise.all(
      messages.map(async (message) =>
        parseSlackMrkdwn(
          await extractMessageText(message, false, teamId, client),
        ).plainText(teamId, client, {}, this.slackDataStore),
      ),
    );

    return messageTexts.map((text, i) => ({
      text,
      username: userOrBotDetails[i].name,
      isBot: userOrBotIds[i].is_bot,
    }));
  }
}
