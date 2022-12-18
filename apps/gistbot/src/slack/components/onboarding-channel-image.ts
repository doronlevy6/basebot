import { ImageBlock } from '@slack/web-api';

const IMAGE_URL =
  'https://assets.thegist.ai/gist/assets/onboarding_channel_2.jpg';

export const OnboardingChannelImage = (altText?: string): ImageBlock => {
  return {
    type: 'image',
    image_url: IMAGE_URL,
    alt_text: altText || 'channel summary example',
  };
};
