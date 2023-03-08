import { KnownBlock } from '@slack/web-api';
import { SLACK_MAX_TEXT_BLOCK_LENGTH } from '../constants';

const DEFAULT_DELIMETER = '\n\n'; // Signifies a new section

export const LongTextBlock = (
  text: string,
  delimeter: string = DEFAULT_DELIMETER,
): KnownBlock[] => {
  const isTooLong = text.length >= SLACK_MAX_TEXT_BLOCK_LENGTH;
  if (!isTooLong) {
    return [TextBlock(text)];
  }

  const splits = text
    .split(delimeter)
    .flatMap((str) => splitString(str, SLACK_MAX_TEXT_BLOCK_LENGTH));

  return splits.map((str) => TextBlock(str));
};

const TextBlock = (text: string): KnownBlock => ({
  type: 'section',
  text: {
    type: 'mrkdwn',
    text,
  },
});

const splitString = (str: string, chunkSize: number) => {
  if (str.length <= chunkSize) {
    return [str];
  }

  const chunksCount = Math.ceil(str.length / chunkSize);
  const chunks: string[] = new Array(chunksCount);
  for (let i = 0; i < chunksCount; i++) {
    chunks[i] = str.substring(i * chunkSize, (i + 1) * chunkSize);
  }

  return chunks;
};
