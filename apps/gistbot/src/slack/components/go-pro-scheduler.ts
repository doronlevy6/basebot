import { KnownBlock } from '@slack/web-api';
import { GoProButton } from './go-pro-button';
import { PromoCodeText } from './promo-code-text';

export const GoProSchedulerText = (channelIds: string[], limit: number) => {
  const channels = channelIds.map((c) => `<#${c}> `);
  return `Our free plan supports up to ${limit} channel summaries. ${channels} were not included in theGist. Upgrade to pro in order to see them in the next summary. ${PromoCodeText()}`;
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
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: GoProSchedulerText(channelIds, limit),
      },
      accessory: GoProButton(),
    },
  ];
};
