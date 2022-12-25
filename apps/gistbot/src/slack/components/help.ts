import { KnownBlock } from '@slack/web-api';
import { OnboardingChannelImage } from './onboarding-channel-image';
import { OnboardingChatImage } from './onboarding-chat-image';
import { OnboardingDigestImage } from './onboarding-digest-image';
import { OnboardingInfoImage } from './onboarding-info-image';
import { OnboardingIntroImage } from './onboarding-intro-image';
import { OnboardingThreadImage } from './onboarding-thread-image';
import { UserLink } from './user-link';

export const Help = (userId: string): KnownBlock[] => {
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
    OnboardingChatImage(),
    OnboardingInfoImage(),
  ];
};
