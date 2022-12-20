import { AnalyticsManager } from '@base/gistbot-shared';
import { Logger, WebClient } from '@slack/web-api';
import { Message } from '@slack/web-api/dist/response/ChannelsHistoryResponse';
import { ChatModel } from './chat.model';

const STOP_WORDS = ['stop', 'reset'];
const MAX_SESSION_DURATION_SEC = 5 * 60;

interface IProps {
  logger: Logger;
  client: WebClient;
  userId: string;
  channelId: string;
  teamId: string;
}

export class ChatManager {
  constructor(
    private chatModel: ChatModel,
    private analyticsManager: AnalyticsManager,
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

      logger.debug(
        `chatGist loaded ${relatedMessages?.length} session messages`,
      );

      const start =
        'James:\nI am a human\n\nBot:\nI am a bot named chatGist which answers any question and can write code.\n\n';

      const prompt = relatedMessages?.map((m) => {
        const username = m.bot_profile ? 'Bot' : 'James';
        return `${username}:\n${m.text}\n\n`;
      });
      const end = 'Bot:\n';

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
}
