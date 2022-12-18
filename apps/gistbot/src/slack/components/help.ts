import { KnownBlock } from '@slack/web-api';
import { OnboardingChannelImage } from './onboarding-channel-image';
import { OnboardingDigestImage } from './onboarding-digest-image';
import { OnboardingFinalImage } from './onboarding-final-image';
import { OnboardingInfoImage } from './onboarding-info-image';
import { OnboardingIntroImage } from './onboarding-intro-image';
import { OnboardingThreadImage } from './onboarding-thread-image';
import { UserLink } from './user-link';

export const Help = (userId: string, myBotUserId: string): KnownBlock[] => {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Hey ${UserLink(
          userId,
        )} :wave: I'm theGist.\nI’m here to help you save time by summarizing channels and threads!`,
      },
    },
    {
      type: 'divider',
    },
    OnboardingIntroImage(),
    OnboardingChannelImage(),
    OnboardingDigestImage(),
    OnboardingThreadImage(),
    OnboardingInfoImage(),
    OnboardingFinalImage(),
  ];
};
