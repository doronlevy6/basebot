import { KnownBlock } from '@slack/web-api';
import { Help } from './help';
import { AddToMultipleChannels } from './add-to-multiple-channels';
import { OnboardingFirstSummaryDivider } from './onboarding-first-summary-divider';
import { AddToSingleChannel } from './add-to-single-channel';
import { isTriggerContext } from '../../onboarding/types';

export const Welcome = (
  userId: string,
  myBotUserId: string,
  onboardingContext: string,
): KnownBlock[] => {
  const closingBlock = isTriggerContext(onboardingContext)
    ? AddToMultipleChannels()
    : [...OnboardingFirstSummaryDivider(), ...AddToSingleChannel(true)];
  return [
    ...Help(userId, myBotUserId),
    {
      type: 'divider',
    },
    ...closingBlock,
  ];
};
