import { ImageBlock } from '@slack/web-api';

const IMAGE_URL =
  'https://assets.thegist.ai/gist/assets/onboarding_digest_3.jpg';

export const OnboardingDigestImage = (altText?: string): ImageBlock => {
  return {
    type: 'image',
    image_url: IMAGE_URL,
    alt_text: altText || 'onboarding digest',
  };
};
