import { ImageBlock } from '@slack/web-api';

const IMAGE_URL =
  'https://assets.thegist.ai/gist/assets/thread-summary-image.jpeg';

export const ThreadSummaryImage = (
  text?: string,
  altText?: string,
): ImageBlock => {
  return {
    type: 'image',
    title: {
      type: 'plain_text',
      text: text || 'thread summary example',
      emoji: true,
    },
    image_url: IMAGE_URL,
    alt_text: altText || 'thread summary example',
  };
};
