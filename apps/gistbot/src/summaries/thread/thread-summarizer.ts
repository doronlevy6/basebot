import { logger } from '@base/logger';
import { RespondFn } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '../../analytics/manager';
import { Routes } from '../../routes/router';
import { Summary } from '../../slack/components/summary';
import { UserLink } from '../../slack/components/user-link';
import { ModerationError } from '../errors/moderation-error';
import { MAX_PROMPT_CHARACTER_COUNT } from '../models/prompt-character-calculator';
import { ThreadSummaryModel } from '../models/thread-summary.model';
import { SlackMessage, ThreadSummarizationProps } from '../types';
import { filterUnwantedMessages, parseThreadForSummary } from '../utils';

export class ThreadSummarizer {
  constructor(
    private threadSummaryModel: ThreadSummaryModel,
    private analyticsManager: AnalyticsManager,
  ) {}

  async summarize(
    myBotId: string,
    teamId: string,
    userId: string,
    props: ThreadSummarizationProps,
    client: WebClient,
    respond?: RespondFn,
  ): Promise<void> {
    try {
      const messageReplies: SlackMessage[] = [];

      // eslint-disable-next-line no-constant-condition
      while (true) {
        let cursor = '';
        const messageRepliesRes = await client.conversations.replies({
          channel: props.channelId,
          ts: props.threadTs,
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
            return filterUnwantedMessages(m, myBotId);
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

      const {
        messages: messagesTexts,
        users,
        titles,
      } = await parseThreadForSummary(
        [...messageReplies],
        client,
        teamId,
        MAX_PROMPT_CHARACTER_COUNT,
        props.channelName,
        myBotId,
      );

      logger.info(
        `Attempting to summarize thread with ${messagesTexts.length} messages and ${users.length} users`,
      );

      this.analyticsManager.threadSummaryFunnel({
        funnelStep: 'requesting_from_api',
        slackTeamId: teamId,
        slackUserId: userId,
        channelId: props.channelId,
        threadTs: props.threadTs,
        extraParams: {
          numberOfMessages: messagesTexts.length,
          numberOfUsers: users.length,
          numberOfUniqueUsers: new Set(users).size,
        },
      });

      const summary = await this.threadSummaryModel.summarizeThread(
        {
          messages: messagesTexts,
          names: users,
          titles: titles,
          channel_name: props.channelName,
        },
        userId,
      );

      if (!summary.length) {
        throw new Error('Invalid response');
      }

      const summaryParts: string[] = [];
      if (summary.length <= 3000) {
        summaryParts.push(summary);
      } else {
        const lines = summary.split('\n');

        let summaryPart = '';
        lines.forEach((line) => {
          if (summaryPart.length > 2000) {
            summaryParts.push(`${summaryPart}`);
            summaryPart = '';
          }
          summaryPart = `${summaryPart}${line}\n`;
        });
        summaryParts.push(summaryPart);
      }

      const basicText = `${UserLink(
        userId,
      )} requested a summary for this thread:`;
      const blocks = Summary({
        actionId: Routes.THREAD_SUMMARY_FEEDBACK,
        basicText: basicText,
        summaryParts: summaryParts,
      });

      if (respond) {
        await respond({
          response_type: 'in_channel',
          text: basicText,
          thread_ts: props.threadTs,
          blocks: blocks,
        });
      } else {
        await client.chat.postMessage({
          channel: props.channelId,
          text: basicText,
          thread_ts: props.threadTs,
          blocks: blocks,
        });
      }

      this.analyticsManager.threadSummaryFunnel({
        funnelStep: 'summarized',
        slackTeamId: teamId,
        slackUserId: userId,
        channelId: props.channelId,
        threadTs: props.threadTs,
        extraParams: {
          numberOfMessages: messagesTexts.length,
          numberOfUsers: users.length,
          numberOfUniqueUsers: new Set(users).size,
        },
      });
    } catch (error) {
      logger.error(`error in thread summarizer: ${error.stack}`);
      if (error instanceof ModerationError) {
        if (respond) {
          await respond({
            response_type: 'ephemeral',
            text: "This summary seems to be inappropriate :speak_no_evil:\nI'm not able to help you in this case.",
          });
        } else {
          client.chat.postEphemeral({
            text: "This summary seems to be inappropriate :speak_no_evil:\nI'm not able to help you in this case.",
            channel: props.channelId,
            user: userId,
          });
        }

        this.analyticsManager.threadSummaryFunnel({
          funnelStep: 'moderated',
          slackTeamId: teamId,
          slackUserId: userId,
          channelId: props.channelId,
          threadTs: props.threadTs,
        });
        return;
      }

      if (respond) {
        await respond({
          response_type: 'ephemeral',
          text: `We had an error processing the summarization: ${error.message}`,
          thread_ts: props.threadTs,
        });
      } else {
        client.chat.postEphemeral({
          text: `We had an error processing the summarization: ${error.message}`,
          channel: props.channelId,
          user: userId,
          thread_ts: props.threadTs,
        });
      }

      this.analyticsManager.error({
        slackTeamId: teamId,
        slackUserId: userId,
        channelId: props.channelId,
        errorMessage: error.message,
        extraParams: {
          threadTs: props.threadTs,
        },
      });
    }
  }
}
