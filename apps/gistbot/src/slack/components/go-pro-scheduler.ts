import { KnownBlock } from '@slack/web-api';
import { GoProButton } from './go-pro-button';
import { PromoCodeText } from './promo-code-text';

export const GoProSchedulerText = (channelIds: string[], limit: number) => {
  const channels = channelIds.map((c) => `<#${c}> `);
  return `Our free plan supports up to ${limit} channel summaries. ${channels} were not included in this digest. \nBecome a pro member and get unlimited channels summaries and full Gmail control now. ${PromoCodeText()}`;
};

export const GoProScheduler = (
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
          text: GoProSchedulerText(channelIds, limit),
        },
      ],
    },
    {
      type: 'actions',
      elements: [GoProButton()],
    },
  ];
};
