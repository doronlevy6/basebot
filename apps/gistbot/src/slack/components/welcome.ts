import { KnownBlock } from '@slack/web-api';
import { AddToMultipleChannels } from './add-to-multiple-channels';
import { Help } from './help';
import { OnboardingFinalImage } from './onboarding-final-image';

export const Welcome = (userId: string): KnownBlock[] => {
  return [
    ...Help(userId),
    OnboardingFinalImage(),
    {
      type: 'divider',
    },
    ...AddToMultipleChannels(),
  ];
};
