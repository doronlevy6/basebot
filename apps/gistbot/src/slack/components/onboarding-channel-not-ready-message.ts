import { KnownBlock } from '@slack/web-api';

export const onboardingChannelNotReadyMessage = (
  channelErrsIds: string[],
  daysBack: number,
): KnownBlock[] => {
  if (!channelErrsIds?.length) {
    return [];
  }

  const channelErrsLinks = channelErrsIds.map((c) => `<#${c}> `);
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
