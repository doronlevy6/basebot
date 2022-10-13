import { ImageBlock } from '@slack/web-api';

const IMAGE_URL =
  'https://assets.thegist.ai/gist/assets/theGistWelcomeMessage.jpg';

export const MessageShortcutImage = (
  text?: string,
  altText?: string,
): ImageBlock => {
  return {
    type: 'image',
    title: {
      type: 'plain_text',
      text: text || 'message shortcut example',
      emoji: true,
    },
    image_url: IMAGE_URL,
    alt_text: altText || 'message shortcut example',
  };
};
