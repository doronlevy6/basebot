import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '../analytics/manager';
import { Routes } from '../routes/router';
import {
  ChannelSummarizer,
  DEFAULT_DAYS_BACK,
} from '../summaries/channel/channel-summarizer';
import { ThreadSummarizer } from '../summaries/thread/thread-summarizer';
import { SummarizationProps } from '../summaries/types';
import { summaryInProgressMessage } from '../summaries/utils';
import { UserLink } from './components/user-link';
import { ViewAction } from './types';

interface AddToChannelProps {
  teamId: string;
  channelId: string;
  channelName: string;
  currentUser: string;
  summarization?: SummarizationProps;
}

export const addToChannelInstructions = async (
  client: WebClient,
  triggerId: string,
  props: AddToChannelProps,
  analyticsManager: AnalyticsManager,
  myBotId: string,
) => {
  await client.views.open({
    trigger_id: triggerId,
    view: {
      type: 'modal',
      callback_id: Routes.ADD_TO_CHANNEL_SUBMIT,
      notify_on_close: true,
      private_metadata: JSON.stringify(props),
      submit: {
        type: 'plain_text',
        text: 'Add me now!',
        emoji: true,
      },
      close: {
        type: 'plain_text',
        text: 'Close',
        emoji: true,
      },
      title: {
        type: 'plain_text',
        text: `Add theGist to channel`,
        emoji: true,
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text:
              'I can only get the gist of messages in channels that I am a member of.' +
              '\n' +
              `I'm afraid it looks like I'm not a member of #${props.channelName}.` +
              '\n\n' +
              'Just tap the `Add me now!` button to let me in.' +
              '\n' +
              `You can also type \`/invite ${UserLink(
                myBotId,
              )}\` from any channel.`,
          },
        },
      ],
    },
  });

  analyticsManager.modalView({
    type: 'not_in_channel',
    slackUserId: props.currentUser,
    slackTeamId: props.teamId,
    properties: {
      channelId: props.channelId,
    },
  });
};

export const addToChannelHandler =
  (
    analyticsManager: AnalyticsManager,
    channelSummarizer: ChannelSummarizer,
    threadSummarizer: ThreadSummarizer,
  ) =>
  async (params: ViewAction) => {
    const { ack, view, client, body, context, respond } = params;

    try {
      await ack();

      const submitted = body.type === 'view_submission';

      const props = JSON.parse(view.private_metadata) as AddToChannelProps;
      const { channelId, currentUser, teamId, summarization } = props;

      analyticsManager.modalClosed({
        type: 'not_in_channel',
        slackUserId: currentUser,
        slackTeamId: teamId,
        submitted: submitted,
        properties: {
          channelId: channelId,
        },
      });

      if (!submitted) {
        return;
      }

      await addToChannel(client, props, analyticsManager);

      if (summarization && summarization.type === 'channel') {
        analyticsManager.channelSummaryFunnel({
          funnelStep: 'user_requested',
          slackTeamId: teamId,
          slackUserId: currentUser,
          channelId: props.channelId,
        });

        await summaryInProgressMessage(client, props.channelId, currentUser);

        analyticsManager.channelSummaryFunnel({
          funnelStep: 'in_progress_sent',
          slackTeamId: teamId,
          slackUserId: currentUser,
          channelId: props.channelId,
        });

        await channelSummarizer.summarize(
          'add_to_channel',
          context.botId || '',
          teamId,
          currentUser,
          summarization,
          DEFAULT_DAYS_BACK,
          client,
          respond,
        );

        return;
      }

      if (summarization && summarization.type === 'thread') {
        analyticsManager.threadSummaryFunnel({
          funnelStep: 'user_requested',
          slackTeamId: teamId,
          slackUserId: currentUser,
          channelId: summarization.channelId,
          threadTs: summarization.threadTs,
        });

        await summaryInProgressMessage(
          client,
          summarization.channelId,
          currentUser,
          summarization.threadTs,
        );

        analyticsManager.threadSummaryFunnel({
          funnelStep: 'in_progress_sent',
          slackTeamId: teamId,
          slackUserId: currentUser,
          channelId: summarization.channelId,
          threadTs: summarization.threadTs,
        });

        await threadSummarizer.summarize(
          context.botId || '',
          teamId,
          currentUser,
          summarization,
          client,
          respond,
        );
      }
    } catch (err) {
      logger.error(`Add to channel handler error: ${err.stack}`);
    }
  };

export const addToChannel = async (
  client: WebClient,
  props: Omit<AddToChannelProps, 'channelName' | 'summarization'>,
  analyticsManager: AnalyticsManager,
) => {
  try {
    const res = await client.conversations.join({
      channel: props.channelId,
    });

    if (res.error || !res.ok) {
      throw new Error(`failed to join channel: ${res.error}`);
    }

    if (res.warning === 'already_in_channel') {
      // We skip the welcome message if the bot is already in the channel
      // TODO: Do we want maybe an ephemeral message to the user to tell them we are in the channel already?
      return;
    }

    analyticsManager.addedToChannel({
      slackUserId: props.currentUser,
      slackTeamId: props.teamId,
      channelId: props.channelId,
    });
  } catch (err) {
    logger.error(`Add to channel handler error: ${err.stack}`);
  }
};
