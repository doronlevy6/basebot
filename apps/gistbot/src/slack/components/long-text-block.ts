import { KnownBlock } from '@slack/web-api';
import { SLACK_MAX_TEXT_BLOCK_LENGTH } from '../constants';

const DEFAULT_DELIMETER = '\n\n'; // Signifies a new section

export const LongTextBlock = (
  text: string,
  delimeter: string = DEFAULT_DELIMETER,
): KnownBlock[] => {
  const textWithShortLinks = shortenLinks(text);
  const [caption, body] = textWithShortLinks.split(/(?<=\n)/); //Separating the caption from the body.
  const isTooLong = textWithShortLinks.length >= SLACK_MAX_TEXT_BLOCK_LENGTH;

  if (!isTooLong) {
    return [TextBlock(textWithShortLinks)];
  }
  const headBlock = [TextBlock(caption)];

  const bodySplits = body
    .split(delimeter)
    .flatMap((str) => splitString(str, SLACK_MAX_TEXT_BLOCK_LENGTH));

  const BodyBlocks = bodySplits.map((str) => TextBlock(str));
  const bodyAndHeadBlocks = [...headBlock, ...BodyBlocks];

  return bodyAndHeadBlocks;
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

  const sentences = str.includes('. ') ? str.split(/(?<=\. )/) : str.split(/ /); //first priority is to split by sentence. If that's not possible, then splitting by words

  const chunks: string[] = [];
  let currentLine = '';

  for (const sentence of sentences) {
    if (currentLine === '') {
      currentLine = sentence;
    } else if (currentLine.length + sentence.length + 1 < chunkSize) {
      currentLine += ' ' + sentence;
    } else {
      if (currentLine[0] !== '>') {
        chunks.push('>' + currentLine);
      } else {
        chunks.push(currentLine);
      }
      currentLine = sentence;
    }
  }

  if (currentLine !== '') {
    chunks.push('>' + currentLine);
  }

  return chunks;
};
function shortenLinks(text: string): string {
  const urlRegex =
    /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/gi;
  return text.replace(urlRegex, (url) => {
    const matches = url.match(/(?:https?:\/\/(?:www\.)?)?([^/]+)/);
    if (matches) {
      const hostname = matches[1];
      return `<${url}|${hostname}>`;
    }
    return url;
  });
}
