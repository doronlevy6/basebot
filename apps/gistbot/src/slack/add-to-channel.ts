import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '../analytics/manager';
import { Routes } from '../routes/router';
import { ViewAction } from './types';

interface AddToChannelProps {
  teamId: string;
  channelId: string;
  channelName: string;
  currentUser: string;
}

export const addToChannelInstructions = async (
  client: WebClient,
  triggerId: string,
  props: AddToChannelProps,
  analyticsManager: AnalyticsManager,
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
              'You can also type `/invite @theGist` from any channel.',
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
  (analyticsManager: AnalyticsManager) => async (params: ViewAction) => {
    const { ack, view, client, body } = params;

    try {
      await ack();

      const submitted = body.type === 'view_submission';

      const props = JSON.parse(view.private_metadata) as AddToChannelProps;
      const { channelId, currentUser, teamId } = props;

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
    } catch (err) {
      logger.error(`Add to channel handler error: ${err.stack}`);
    }
  };

export const addToChannel = async (
  client: WebClient,
  props: Omit<AddToChannelProps, 'channelName'>,
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
