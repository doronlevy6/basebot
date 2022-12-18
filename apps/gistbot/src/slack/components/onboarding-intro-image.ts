import { ImageBlock } from '@slack/web-api';

const IMAGE_URL =
  'https://assets.thegist.ai/gist/assets/onboarding_intro_1.jpg';

export const OnboardingIntroImage = (altText?: string): ImageBlock => {
  return {
    type: 'image',
    image_url: IMAGE_URL,
    alt_text: altText || 'onboarding intro',
  };
};
