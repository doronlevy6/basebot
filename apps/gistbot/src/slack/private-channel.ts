import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '../analytics/manager';
import { Routes } from '../routes/router';
import { ViewAction } from './types';

interface PrivateChannelProps {
  teamId: string;
  channelId: string;
  channelName: string;
  currentUser: string;
}

export const privateChannelInstructions = async (
  client: WebClient,
  triggerId: string,
  props: PrivateChannelProps,
  analyticsManager: AnalyticsManager,
) => {
  await client.views.open({
    trigger_id: triggerId,
    view: {
      type: 'modal',
      callback_id: Routes.PRIVATE_CHANNEL_SUBMIT,
      notify_on_close: true,
      private_metadata: JSON.stringify(props),
      close: {
        type: 'plain_text',
        text: 'Close',
        emoji: true,
      },
      title: {
        type: 'plain_text',
        text: `This channel is private`,
        emoji: true,
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `It looks like you're trying to use me in a private channel...\n\nFor now, I can't be used in private channels in order to preserve the privacy of those in the channel.`,
          },
        },
      ],
    },
  });

  analyticsManager.modalView({
    type: 'private_channel',
    slackUserId: props.currentUser,
    slackTeamId: props.teamId,
    properties: {
      channelId: props.channelId,
    },
  });
};

export const privateChannelHandler =
  (analyticsManager: AnalyticsManager) => async (params: ViewAction) => {
    const { ack, view, body } = params;

    try {
      await ack();

      const submitted = body.type === 'view_submission';

      const { channelId, currentUser, teamId } = JSON.parse(
        view.private_metadata,
      ) as PrivateChannelProps;

      analyticsManager.modalClosed({
        type: 'private_channel',
        slackUserId: currentUser,
        slackTeamId: teamId,
        submitted: submitted,
        properties: {
          channelId: channelId,
        },
      });
    } catch (err) {
      logger.error(`Add to channel handler error: ${err.stack}`);
    }
  };
