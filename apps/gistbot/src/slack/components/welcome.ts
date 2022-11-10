import { KnownBlock } from '@slack/web-api';
import { Help } from './help';
import { AddMoreMultipleChannels } from './add-more-multiple-channels';
import { OnboardingFirstSummaryDivider } from './onboarding-first-summary-divider';
import { AddToMultipleChannels } from './add-to-multiple-channels';
import { isTriggerContext } from '../../onboarding/types';

export const Welcome = (
  userId: string,
  myBotUserId: string,
  onboardingContext: string,
): KnownBlock[] => {
  const closingBlock = isTriggerContext(onboardingContext)
    ? AddMoreMultipleChannels()
    : [...OnboardingFirstSummaryDivider(), ...AddToMultipleChannels(true)];
  return [
    ...Help(userId, myBotUserId),
    {
      type: 'divider',
    },
    ...closingBlock,
  ];
};
