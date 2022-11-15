import { KnownBlock } from '@slack/web-api';
import { onboardingChannelNotReadyMessage } from './onboarding-channel-not-ready-message';

export const onboardingChannelSummarizeMessage = (
  succesChannelsIds: string[],
  errorChannelsIds: string[],
  allChannelsIds: string[],
  daysBack: number,
): KnownBlock[] => {
  if (!succesChannelsIds?.length) {
    return [
      ...onboardingChannelNotReadyMessage(
        errorChannelsIds,
        allChannelsIds,
        daysBack,
      ),
    ];
  }

  const successLinks = succesChannelsIds.map((c) => `<#${c}> `);
  const text = `*Done! Let's go see them at* ${successLinks.join('')} 👀.`;
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: text,
      },
    },
    ...onboardingChannelNotReadyMessage(
      errorChannelsIds,
      allChannelsIds,
      daysBack,
    ),
    {
      type: 'divider',
    },
  ];
};
