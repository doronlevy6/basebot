import { ParsedMessage, parseSlackMrkdwn } from './parser';
import { ChannelLinkSection } from './sections/channel-link-section';
import { LocalizedDateSection } from './sections/localized-date-section';
import { SpecialMentionSection } from './sections/special-mention-section';
import { TextSection } from './sections/text-section';
import { UrlLinkSection } from './sections/url-link-section';
import { UserGroupMentionSection } from './sections/user-group-mention-section';
import { UserMentionSection } from './sections/user-mention-section';

describe('parseSlackMrkdwn', () => {
  it('should parse normal text as normal text', async () => {
    const originalText = 'this is some normal text without any formatting';
    const expected = new ParsedMessage({
      originalText: originalText,
      sections: [
        new TextSection({
          text: 'this is some normal text without any formatting',
        }),
      ],
    });
    expect(parseSlackMrkdwn(originalText)).toEqual(expected);
    expect(await parseSlackMrkdwn(originalText).plainText('')).toEqual(
      originalText,
    );
  });

  it('should parse channel link as channel link', async () => {
    const originalText =
      'this is some message with a channel link to the <#C024BE7LR> channel and the <#C024BE7LQ> channel';
    const expectedPlainText =
      'this is some message with a channel link to the C024BE7LR channel and the C024BE7LQ channel';
    const expected = new ParsedMessage({
      originalText: originalText,
      sections: [
        new TextSection({
          text: 'this is some message with a channel link to the ',
        }),
        new ChannelLinkSection({
          channelId: 'C024BE7LR',
        }),
        new TextSection({
          text: ' channel and the ',
        }),
        new ChannelLinkSection({
          channelId: 'C024BE7LQ',
        }),
        new TextSection({
          text: ' channel',
        }),
      ],
    });
    expect(parseSlackMrkdwn(originalText)).toEqual(expected);
    expect(await parseSlackMrkdwn(originalText).plainText('')).toEqual(
      expectedPlainText,
    );
  });

  it('should parse channel link with label as channel link with label', async () => {
    const originalText =
      'this is some message with a channel link to the <#C024BE7LR|random-channel-name> channel and the <#C024BE7LQ> channel';
    const expectedPlainText =
      'this is some message with a channel link to the random-channel-name channel and the C024BE7LQ channel';
    const expected = new ParsedMessage({
      originalText: originalText,
      sections: [
        new TextSection({
          text: 'this is some message with a channel link to the ',
        }),
        new ChannelLinkSection({
          channelId: 'C024BE7LR',
          label: 'random-channel-name',
        }),
        new TextSection({
          text: ' channel and the ',
        }),
        new ChannelLinkSection({
          channelId: 'C024BE7LQ',
        }),
        new TextSection({
          text: ' channel',
        }),
      ],
    });
    expect(parseSlackMrkdwn(originalText)).toEqual(expected);
    expect(await parseSlackMrkdwn(originalText).plainText('')).toEqual(
      expectedPlainText,
    );
  });

  it('should parse user mention as user mention', async () => {
    const originalText =
      'this is some message with a user mention to <@U123123123> and <@W123123123>';
    const expectedPlainText =
      'this is some message with a user mention to @U123123123 and @W123123123';
    const expected = new ParsedMessage({
      originalText: originalText,
      sections: [
        new TextSection({
          text: 'this is some message with a user mention to ',
        }),
        new UserMentionSection({
          userId: 'U123123123',
        }),
        new TextSection({
          text: ' and ',
        }),
        new UserMentionSection({
          userId: 'W123123123',
        }),
      ],
    });
    expect(parseSlackMrkdwn(originalText)).toEqual(expected);
    expect(await parseSlackMrkdwn(originalText).plainText('')).toEqual(
      expectedPlainText,
    );
  });

  it('should parse user mention with label as user mention with label', async () => {
    const originalText =
      'this is some message with a user mention to <@U123123123|Itay> and <@W123123123>';
    const expectedPlainText =
      'this is some message with a user mention to @Itay and @W123123123';
    const expected = new ParsedMessage({
      originalText: originalText,
      sections: [
        new TextSection({
          text: 'this is some message with a user mention to ',
        }),
        new UserMentionSection({
          userId: 'U123123123',
          label: 'Itay',
        }),
        new TextSection({
          text: ' and ',
        }),
        new UserMentionSection({
          userId: 'W123123123',
        }),
      ],
    });
    expect(parseSlackMrkdwn(originalText)).toEqual(expected);
    expect(await parseSlackMrkdwn(originalText).plainText('')).toEqual(
      expectedPlainText,
    );
  });

  it('should parse user group mention as user group mention', async () => {
    const originalText =
      'this is some message with a user group mention to <!subteam^SAZ94GDB8>';
    const expectedPlainText =
      'this is some message with a user group mention to @SAZ94GDB8';
    const expected = new ParsedMessage({
      originalText: originalText,
      sections: [
        new TextSection({
          text: 'this is some message with a user group mention to ',
        }),
        new UserGroupMentionSection({
          userGroupId: 'SAZ94GDB8',
        }),
      ],
    });
    expect(parseSlackMrkdwn(originalText)).toEqual(expected);
    expect(await parseSlackMrkdwn(originalText).plainText('')).toEqual(
      expectedPlainText,
    );
  });

  it('should parse user group mention with label as user group mention with label', async () => {
    const originalText =
      'this is some message with a user group mention to <!subteam^SAZ94GDB8|engineering>';
    const expectedPlainText =
      'this is some message with a user group mention to @engineering';
    const expected = new ParsedMessage({
      originalText: originalText,
      sections: [
        new TextSection({
          text: 'this is some message with a user group mention to ',
        }),
        new UserGroupMentionSection({
          userGroupId: 'SAZ94GDB8',
          label: 'engineering',
        }),
      ],
    });
    expect(parseSlackMrkdwn(originalText)).toEqual(expected);
    expect(await parseSlackMrkdwn(originalText).plainText('')).toEqual(
      expectedPlainText,
    );
  });

  it('should parse localized date as localized date', async () => {
    const originalText =
      'this is some message with a localized date formatting <!date^1392734382^Posted {date_num} {time_secs}|Posted 2014-02-18 6:39:42 AM PST> here';
    const expectedPlainText =
      'this is some message with a localized date formatting 2014-02-18T14:39:42.000Z here';
    const expected = new ParsedMessage({
      originalText: originalText,
      sections: [
        new TextSection({
          text: 'this is some message with a localized date formatting ',
        }),
        new LocalizedDateSection({
          unix: 1392734382,
          format: 'Posted {date_num} {time_secs}',
          fallback: 'Posted 2014-02-18 6:39:42 AM PST',
        }),
        new TextSection({
          text: ' here',
        }),
      ],
    });
    expect(parseSlackMrkdwn(originalText)).toEqual(expected);
    expect(await parseSlackMrkdwn(originalText).plainText('')).toEqual(
      expectedPlainText,
    );
  });

  it('should parse localized date with fallback as localized date with fallback', async () => {
    const originalText =
      'this is some message with a localized date formatting <!date^1392734382^Posted {date_num} {time_secs}|Posted 2014-02-18 6:39:42 AM PST> here';
    const expectedPlainText =
      'this is some message with a localized date formatting 2014-02-18T14:39:42.000Z here';
    const expected = new ParsedMessage({
      originalText: originalText,
      sections: [
        new TextSection({
          text: 'this is some message with a localized date formatting ',
        }),
        new LocalizedDateSection({
          unix: 1392734382,
          format: 'Posted {date_num} {time_secs}',
          fallback: 'Posted 2014-02-18 6:39:42 AM PST',
        }),
        new TextSection({
          text: ' here',
        }),
      ],
    });
    expect(parseSlackMrkdwn(originalText)).toEqual(expected);
    expect(await parseSlackMrkdwn(originalText).plainText('')).toEqual(
      expectedPlainText,
    );
  });

  it('should parse special mention as special mention', async () => {
    const originalText =
      '<!here> this is some message with a special mention to <!channel>';
    const expectedPlainText =
      '@here this is some message with a special mention to @channel';
    const expected = new ParsedMessage({
      originalText: originalText,
      sections: [
        new SpecialMentionSection({
          mention: 'here',
        }),
        new TextSection({
          text: ' this is some message with a special mention to ',
        }),
        new SpecialMentionSection({
          mention: 'channel',
        }),
      ],
    });
    expect(parseSlackMrkdwn(originalText)).toEqual(expected);
    expect(await parseSlackMrkdwn(originalText).plainText('')).toEqual(
      expectedPlainText,
    );
  });

  it('should parse special mention with label as special mention with label', async () => {
    const originalText =
      '<!here|here> this is some message with a special mention to <!channel>';
    const expectedPlainText =
      '@here this is some message with a special mention to @channel';
    const expected = new ParsedMessage({
      originalText: originalText,
      sections: [
        new SpecialMentionSection({
          mention: 'here',
          label: 'here',
        }),
        new TextSection({
          text: ' this is some message with a special mention to ',
        }),
        new SpecialMentionSection({
          mention: 'channel',
        }),
      ],
    });
    expect(parseSlackMrkdwn(originalText)).toEqual(expected);
    expect(await parseSlackMrkdwn(originalText).plainText('')).toEqual(
      expectedPlainText,
    );
  });

  it('should parse url link as url link', async () => {
    const originalText = 'This message contains a URL <http://example.com/>';
    const expectedPlainText = 'This message contains a URL http://example.com/';
    const expected = new ParsedMessage({
      originalText: originalText,
      sections: [
        new TextSection({
          text: 'This message contains a URL ',
        }),
        new UrlLinkSection({
          url: 'http://example.com/',
        }),
      ],
    });
    expect(parseSlackMrkdwn(originalText)).toEqual(expected);
    expect(await parseSlackMrkdwn(originalText).plainText('')).toEqual(
      expectedPlainText,
    );
  });

  it('should url link with label as url link with label', async () => {
    const originalText =
      'So does this one: <http://example.com|www.example.com>';
    const expectedPlainText = 'So does this one: www.example.com';
    const expected = new ParsedMessage({
      originalText: originalText,
      sections: [
        new TextSection({
          text: 'So does this one: ',
        }),
        new UrlLinkSection({
          url: 'http://example.com',
          label: 'www.example.com',
        }),
      ],
    });
    expect(parseSlackMrkdwn(originalText)).toEqual(expected);
    expect(await parseSlackMrkdwn(originalText).plainText('')).toEqual(
      expectedPlainText,
    );
  });
});
