import { KnownBlock } from '@slack/web-api';
import { Routes } from '../../routes/router';
import { UserLink } from './user-link';
import { TriggersFeedBack } from './trigger-feedback';
import { MentionedInChannelProps } from '../../summaries/mentioned-in-channel-handler';

export const MentionedInChannelText = (
  presence: string,
  botUserId: string,
  userId: string,
  channelId: string,
): string => {
  if (presence === 'away') {
    return `Hi ${UserLink(userId)} I'm ${UserLink(
      botUserId,
    )}, I make life simpler by summarizing discussions on Slack.\n\nYou were mentioned in <#${channelId}>.\n\nWould you like a summary of the discussion so far?`;
  } else {
    return `Hi ${UserLink(userId)} I'm ${UserLink(
      botUserId,
    )}, I make life simpler by summarizing discussions on Slack.\n\nYou were mentioned in this channel.\n\nWould you like a summary of the discussion so far?`;
  }
};
export const MentionedInChannel = (
  basicText: string,
  props: MentionedInChannelProps,
): KnownBlock[] => {
  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: basicText,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Summarize this channel',
            emoji: true,
          },
          style: 'primary',
          value: JSON.stringify(props),
          action_id: Routes.SUMMARIZE_CHANNEL_FROM_CHANNEL_MENTION,
        },
      ],
    },
  ];
  blocks.push(...TriggersFeedBack('channel_mention'));
  return blocks;
};
