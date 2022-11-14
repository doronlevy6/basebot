import { ImageBlock } from '@slack/web-api';

const IMAGE_URL =
  'https://assets.thegist.ai/gist/assets/channel_summary_help.jpg';

export const ChannelSummaryImage = (
  text?: string,
  altText?: string,
): ImageBlock => {
  return {
    type: 'image',
    title: {
      type: 'plain_text',
      text: text || 'channel summary example',
      emoji: true,
    },
    image_url: IMAGE_URL,
    alt_text: altText || 'channel summary example',
  };
};
