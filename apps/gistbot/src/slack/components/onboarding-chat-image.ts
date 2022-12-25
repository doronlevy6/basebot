import { ImageBlock } from '@slack/web-api';

const IMAGE_URL = 'https://assets.thegist.ai/gist/assets/onboarding_chat.jpg';

export const OnboardingChatImage = (altText?: string): ImageBlock => {
  return {
    type: 'image',
    image_url: IMAGE_URL,
    alt_text: altText || 'new chat',
  };
};
