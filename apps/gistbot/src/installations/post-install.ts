import { WebClient } from '@slack/web-api';
import { AnalyticsManager } from '../analytics/manager';
import { Routes } from '../routes/router';
import { MessageShortcutImage } from '../slack/components/message-shortcut-image';
import { UserLink } from '../slack/components/user-link';
import { identifyTriggeringUser } from '../summaries/utils';

export const postInstallationMessage = async (
  userId: string,
  teamId: string,
  token: string,
  analyticsManager: AnalyticsManager,
) => {
  const client = new WebClient(token);

  // Don't await so that we don't force anything to wait just for the identification.
  // This handles error handling internally and will never cause an exception, so we
  // won't have any unhandled promise rejection errors.
  identifyTriggeringUser(userId, teamId, client, analyticsManager);

  await client.chat.postMessage({
    channel: userId,
    text: `Hey ${UserLink(userId)} :wave: I'm theGist!`,
    user: userId,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Hey ${UserLink(
            userId,
          )} :wave: I'm theGist!\nI'm here to help you summarize channels and threads in Slack.\nThis will help you save time going over long discussions in channels or quickly get up to speed when you're mentioned in a thread.`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':one: Use the /gist command. Type /gist in any channel to catchup on the discussion.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':two: Use the message shortcut to instantly get a summary of the message or the thread (shown below).',
        },
      },
      MessageShortcutImage(),
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "To start getting the Gist, add me to a channel and I'll introduce myself. I'm usually added to a team or project channel. Type /invite @theGist from the channel or pick a channel on the right.",
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Select a channel...',
            emoji: true,
          },
          action_id: Routes.ADD_TO_CHANNEL_FROM_WELCOME_MODAL,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: ':eyes: Want to learn more about theGist? Click <https://thegist.ai/|here!>\n\n:question: Get help at any time with /gist help',
          },
        ],
      },
    ],
  });

  return;
};
