import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { Routes } from '../routes/router';
import { UserLink } from './components/user-link';
import { ViewAction } from './types';

interface AddToChannelProps {
  channelId: string;
  channelName: string;
  currentUser: string;
}

export const addToChannelInstructions = async (
  client: WebClient,
  triggerId: string,
  props: AddToChannelProps,
) => {
  client.views.open({
    trigger_id: triggerId,
    view: {
      type: 'modal',
      callback_id: Routes.ADD_TO_CHANNEL_SUBMIT,
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
        text: `I'm not a member!`,
        emoji: true,
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `I can only get the gist of messages in channels that I am a member of, and it looks like unfortunately, I'm not a member of #${props.channelName}.\n\nBut you're in luck! There is a very easy way to add me as a member :smile:`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: "To a let me summarize threads and channels for you, type `/invite @GistBot` from the channel you want to add me to and I'll get started right away!",
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'You can also add me right now to the channel you\'re currently in by clicking the big "Add me now!" button, and I\'ll go ahead and introduce myself to the team.',
          },
        },
      ],
    },
  });
};

export const addToChannelHandler = async (params: ViewAction) => {
  const { ack, view, client } = params;

  try {
    await ack();

    const { channelId, channelName, currentUser } = JSON.parse(
      view.private_metadata,
    ) as AddToChannelProps;

    await client.conversations.join({
      channel: channelId,
    });

    await client.chat.postMessage({
      channel: channelId,
      text: `Hello! I'm GistBot :smile:\n\n${UserLink(
        currentUser,
      )} added me here to #${channelName} in order to help you all get the gist of things happening in this channel whenever you need!`,
    });
  } catch (err) {
    // TODO: update modal view with error
    logger.error(`Add to channel handler error: ${err}`);
  }
};
