import { KnownBlock } from '@slack/web-api';
export const GoExProSchedulerText = (channelIds: string[], limit: number) => {
  const channels = channelIds.map((c) => `<#${c}>`);
  const channelsNotJoined = channels.join(' & ');
  return `You have reached the maximum number of channels (${limit}), we couldn’t show ${channelsNotJoined}. Please contact support@thegist.ai for more channels.`;
};

export const GoExProScheduler = (
  limit: number,
  channelIds?: string[],
): KnownBlock[] => {
  if (!channelIds?.length) {
    return [];
  }
  return [
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: GoExProSchedulerText(channelIds, limit),
        },
      ],
    },
  ];
};
