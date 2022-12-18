import { ImageBlock } from '@slack/web-api';

const IMAGE_URL = 'https://assets.thegist.ai/gist/assets/onboarding_info_5.jpg';

export const OnboardingInfoImage = (altText?: string): ImageBlock => {
  return {
    type: 'image',
    image_url: IMAGE_URL,
    alt_text: altText || 'onboarding info',
  };
};
