import { stripMrkdwnFormatting, TextSection } from './text-section';

describe('stripMrkdwnFormatting', () => {
  it('should strip code formatting', async () => {
    const originalText =
      'this is some text `with code formatting and formatting`';
    const expectedText =
      'this is some text with code formatting and formatting';
    expect(stripMrkdwnFormatting(originalText, '`')).toEqual(expectedText);
  });

  it('should strip multi-line code formatting', async () => {
    const originalText =
      'this is some text ```with multiline code formatting\n\nand formatting```';
    const expectedText =
      'this is some text with multiline code formatting\n\nand formatting';
    expect(stripMrkdwnFormatting(originalText, '```', true)).toEqual(
      expectedText,
    );
  });

  it('should strip italics formatting', async () => {
    const originalText =
      'this is some text _with italics formatting and formatting_';
    const expectedText =
      'this is some text with italics formatting and formatting';
    expect(stripMrkdwnFormatting(originalText, '_')).toEqual(expectedText);
  });

  it('should strip bold formatting', async () => {
    const originalText =
      'this is some text *with bold formatting and formatting*';
    const expectedText =
      'this is some text with bold formatting and formatting';
    expect(stripMrkdwnFormatting(originalText, `\\*`)).toEqual(expectedText);
  });

  it('should strip strike formatting', async () => {
    const originalText =
      'this is some text ~with strike formatting and formatting~';
    const expectedText =
      'this is some text with strike formatting and formatting';
    expect(stripMrkdwnFormatting(originalText, `~`)).toEqual(expectedText);
  });
});

describe('strip TextSection', () => {
  it('should strip all formatting', async () => {
    const originalText =
      'this is some text `with code formatting` along with _italics_ ~and~ some *bold stuff* as well.\n\nWow heres a ```multiline\n\ncode\n\ncomment```';
    const expectedText =
      'this is some text with code formatting along with italics and some bold stuff as well.\n\nWow heres a multiline\n\ncode\n\ncomment';

    const section = new TextSection({ text: originalText });

    expect(await section.plainText('')).toEqual(expectedText);
  });
});
