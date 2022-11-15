import { KnownBlock } from '@slack/web-api';

export const onboardingChannelNotReadyMessage = (
  channelErrsIds: string[],
  allChannelsIds: string[],
  daysBack: number,
): KnownBlock[] => {
  if (!channelErrsIds?.length) {
    return [];
  }

  const channelErrsLinks = channelErrsIds.map((c) => `<#${c}> `);

  if (channelErrsIds.length === allChannelsIds?.length) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `There weren't any meaningful conversations to summarize in ${channelErrsLinks} in the last ${daysBack} days.\nPlease select other channels :arrow_up:`,
        },
      },
    ];
  }
  return [
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `There weren't any meaningful conversations to summarize in ${channelErrsLinks} in the last ${daysBack} days.`,
        },
      ],
    },
  ];
};
