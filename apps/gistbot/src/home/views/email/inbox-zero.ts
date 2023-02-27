import { KnownBlock } from '@slack/web-api';
import { congratulationsGifs } from './congratulation-gifs';

export const InboxZeroBlocks = (): KnownBlock[] => [
  {
    type: 'header',
    text: {
      type: 'plain_text',
      text: 'Congratulations you have reached inbox zero 🎉',
      emoji: true,
    },
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '✨ There are no new unread emails ✨',
    },
  },
  {
    type: 'image',
    image_url: gifForInboxZero(),
    alt_text: 'congrats',
  },
];

function gifForInboxZero(): string {
  // Creates a number according to the day of the month.
  const today = new Date();
  const dayOfMonth = today.getDate();
  const totalDaysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate();

  // For higher variance we double the rotation speed.
  const percentage = ((dayOfMonth * 2) / totalDaysInMonth) % 1;
  return congratulationsGifs[
    Math.floor(percentage * (congratulationsGifs.length - 1))
  ];
}
