import { AnalyticsManager } from '@base/gistbot-shared';
import { Logger, WebClient } from '@slack/web-api';
import { Message } from '@slack/web-api/dist/response/ConversationsHistoryResponse';
import { extractMessageText } from '../../slack/message-text';
import { parseSlackMrkdwn } from '../../slack/parser';
import { getUserOrBotDetails, isGistAppId } from '../../summaries/utils';
import { ChatModel } from './chat.model';
import { SlackDataStore } from '../../utils/slack-data-store';
import { chatModelPrompt } from './prompt';
import { IChatMessage } from './types';
import { Feature } from '../../feature-rate-limiter/limits';
import { RateLimitedError } from '../../summaries/errors/rate-limited-error';
import { FeatureRateLimiter } from '../../feature-rate-limiter/rate-limiter';
import { responder } from '../../slack/responder';
import { ChatGoPro, ChatGoProText } from '../../slack/components/chat-go-pro';
import { approximatePromptCharacterCountForChatMessages } from '../../summaries/models/prompt-character-calculator';
import { AllMessagesPrefilteredError } from '../../summaries/errors/all-messages-filtered-error';

const STOP_WORDS = ['stop', 'reset'];
const MAX_SESSION_DURATION_SEC = 5 * 60;
const MAX_PROMPT_CHARACTER_COUNT = 11000;
interface IProps {
  logger: Logger;
  client: WebClient;
  userId: string;
  channelId: string;
  teamId: string;
  threadTs?: string;
}

export class ChatManager {
  constructor(
    private chatModel: ChatModel,
    private analyticsManager: AnalyticsManager,
    private slackDataStore: SlackDataStore,
    private featureRateLimiter: FeatureRateLimiter,
  ) {}

  async handleChatMessage(props: IProps) {
    const { channelId, client, logger, teamId, userId, threadTs } = props;
    try {
      logger.debug(
        `Chat session running ${JSON.stringify({
          teamId,
          userId,
          channelId,
          threadTs,
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
      const messages = await this.fetchMessages(client, channelId, threadTs);

      if (!messages || !messages.length) {
        logger.error('Couldnt find messages in chat session');
        await client.chat.postMessage({
          channel: channelId,
          text: "Whoops, something ain't right :cry:",
          thread_ts: threadTs,
        });
        return;
      }
      if (this.isNewChatSession(messages)) {
        const limited = await this.featureRateLimiter.acquire(
          { teamId: teamId, userId: userId },
          Feature.CHAT,
        );
        if (!limited) {
          throw new RateLimitedError('rate limited');
        }
      }

      const filterMesages = !props.threadTs;
      let relatedMessages = messages;
      if (filterMesages) {
        relatedMessages = this.filterByTimeSession(messages);
        relatedMessages = this.filterByStopWords(relatedMessages, logger);
      }

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

      const req = [...enrichedMessages];
      let cc = approximatePromptCharacterCountForChatMessages(req);
      while (cc > MAX_PROMPT_CHARACTER_COUNT) {
        if (props.threadTs && req.length >= 2) {
          req.splice(1, 1);
        } else {
          req.shift();
        }
        cc = approximatePromptCharacterCountForChatMessages(req);
      }
      if (req.length === 0) {
        throw new AllMessagesPrefilteredError(
          `all messages pre-filtered before request, original size ${enrichedMessages.length}`,
        );
      }

      const didFilter = req.length < enrichedMessages.length;
      if (didFilter) {
        logger.info(
          `Filtered ${
            enrichedMessages.length - req.length
          } messages to avoid hitting the character limit`,
        );
      }

      logger.debug(
        `chatGist loaded ${relatedMessages?.length} session messages`,
      );

      const prompt = chatModelPrompt(req);
      const res = await this.chatModel.customModel(prompt, userId);

      logger.debug(`Chat response `);

      await client.chat.postMessage({
        channel: channelId,
        text: res,
        thread_ts: threadTs,
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
      if (err instanceof RateLimitedError) {
        logger.info(`User has been rate limited`);
        await responder(
          undefined, // Thread ephemeral messages with the respond func don't work correctly so we force undefined in the respond func
          client,
          ChatGoProText,
          ChatGoPro(),
          props.channelId,
          userId,
          { response_type: 'in_channel' },
          props.threadTs,
        );

        this.analyticsManager.rateLimited({
          slackTeamId: teamId,
          slackUserId: userId,
          channelId,
          type: 'chat_message',
        });
        return;
      }
      logger.error(`chatGist handler error: ${err} ${err.stack}`);
      await client.chat.postMessage({
        channel: channelId,
        text: "Whoops, something ain't right :cry:",
        thread_ts: threadTs,
      });
    }
  }

  private async fetchMessages(
    client: WebClient,
    channelId: string,
    threadTs?: string,
  ): Promise<Message[]> {
    if (threadTs) {
      const res = await client.conversations.replies({
        ts: threadTs,
        channel: channelId,
      });
      return (res.messages ?? []) as Message[];
    }

    const res = await client.conversations.history({
      channel: channelId,
    });
    return (res.messages ?? []) as Message[];
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
  ): Promise<IChatMessage[]> {
    const userOrBotIds = messages.map((m) => {
      return {
        is_bot: !m.user,
        user_id: m.user ? m.user : m.bot_id || '',
      };
    });

    const userOrBotDetails = await getUserOrBotDetails(
      [...new Map(userOrBotIds.map((item) => [item.user_id, item])).values()],
      teamId,
      client,
      this.slackDataStore,
    );

    const userBotCombinedData = userOrBotIds.map((userOrBot) => {
      const details = userOrBotDetails.find((d) => d.id === userOrBot.user_id);
      return {
        ...userOrBot,
        name: details?.name || '',
        title: details?.title || '',
      };
    });

    const messageTexts = await Promise.all(
      messages.map(async (message) =>
        parseSlackMrkdwn(
          await extractMessageText(
            message,
            false,
            teamId,
            client,
            this.slackDataStore,
          ),
        ).plainText(teamId, client, {}, this.slackDataStore),
      ),
    );
    return messageTexts.map((text, i) => ({
      text,
      username: userBotCombinedData[i].name,
      isBot: userBotCombinedData[i].is_bot,
      isGistBot: userBotCombinedData[i].name?.toLowerCase().includes('gist'),
    }));
  }

  // if there is no message from our app in this session then it is a new session
  private isNewChatSession(relatedMessages: Message[]) {
    const filteredMessages = this.filterByTimeSession(relatedMessages);
    return !filteredMessages.some((r) => {
      let isLimitMsg = false;

      isLimitMsg = Boolean(
        r?.blocks && r.blocks[0].block_id === 'limit_message',
      );

      return (
        !!r.bot_id &&
        !!r.bot_profile?.app_id &&
        isGistAppId(r.bot_profile?.app_id ?? '') &&
        !isLimitMsg
      );
    });
  }
}
