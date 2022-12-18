import { ImageBlock } from '@slack/web-api';

const IMAGE_URL =
  'https://assets.thegist.ai/gist/assets/onboarding_final_6.jpg';

export const OnboardingFinalImage = (altText?: string): ImageBlock => {
  return {
    type: 'image',
    image_url: IMAGE_URL,
    alt_text: altText || 'onboarding final',
  };
};
