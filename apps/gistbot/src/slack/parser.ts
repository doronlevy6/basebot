import { WebClient } from '@slack/web-api';
import { ChannelLinkSection } from './sections/channel-link-section';
import { LocalizedDateSection } from './sections/localized-date-section';
import { ParsedMessageSection } from './sections/parsed-message-section';
import { SpecialMentionSection } from './sections/special-mention-section';
import { TextSection } from './sections/text-section';
import { UrlLinkSection } from './sections/url-link-section';
import { UserGroupMentionSection } from './sections/user-group-mention-section';
import { UserMentionSection } from './sections/user-mention-section';
import { SlackDataStore } from '../utils/slack-data-store';

interface PlaintextOpts {
  removeCodeblocks: boolean;
  stripUnlabelsUrls: boolean;
  unlabeledUrlReplacement: string;
}

export const defaultParseTextOpts = {
  removeCodeblocks: true,
  stripUnlabelsUrls: true,
  unlabeledUrlReplacement: '<LINK>',
};

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ParsedMessagePlaintextOpts extends Partial<PlaintextOpts> {}

export class ParsedMessage {
  originalText: string;
  sections: ParsedMessageSection[] = [];

  constructor(initial?: {
    originalText?: string;
    sections?: ParsedMessageSection[];
  }) {
    this.originalText = initial?.originalText || '';
    this.sections = initial?.sections || [];
  }

  async plainText(
    teamId: string,
    client?: WebClient,
    opts?: ParsedMessagePlaintextOpts,
    slackDataStore?: SlackDataStore,
  ): Promise<string> {
    const enrichedSections = await Promise.all(
      this.sections.map((current) =>
        current.plainText(teamId, client, opts, slackDataStore),
      ),
    );

    return enrichedSections.reduce((acc, current) => `${acc}${current}`, '');
  }
}

export function parseSlackMrkdwn(mrkdwn: string): ParsedMessage {
  const advFmts = mrkdwn.matchAll(/<(.*?)>/g);
  if (!advFmts) {
    // No advanced formatting sections (not including formatting markdown shit yet)
    const parsed = new ParsedMessage({
      originalText: mrkdwn,
      sections: [new TextSection({ text: mrkdwn })],
    });
    return parsed;
  }

  const sections: ParsedMessageSection[] = [];
  let startIndex = 0;
  for (const advMatch of advFmts) {
    // Check explicitly for null and undefined because 0 is a valid value
    if (advMatch.index === undefined || advMatch.index === null) {
      throw new Error('no index found on match');
    }

    if (advMatch.index > 0) {
      sections.push(
        new TextSection({
          text: mrkdwn.substring(startIndex, advMatch.index),
        }),
      );
    }

    const section = parseAdvancedFormattingSection(advMatch);
    sections.push(section);
    startIndex = advMatch.index + advMatch[0].length;
  }

  if (startIndex < mrkdwn.length) {
    sections.push(
      new TextSection({
        text: mrkdwn.substring(startIndex),
      }),
    );
  }

  const parsed = new ParsedMessage({
    originalText: mrkdwn,
    sections: sections,
  });
  return parsed;
}

function parseAdvancedFormattingSection(
  advMatch: RegExpMatchArray,
): ParsedMessageSection {
  const extractedValue = advMatch[1];

  if (extractedValue.startsWith('#C')) {
    const splitLabel = extractedValue.split('|');
    const channelId = splitLabel[0].substring(1);
    const label = splitLabel.length === 2 ? splitLabel[1] : undefined;
    return new ChannelLinkSection({ channelId, label });
  }

  if (extractedValue.startsWith('@U') || extractedValue.startsWith('@W')) {
    const splitLabel = extractedValue.split('|');
    const userId = splitLabel[0].substring(1);
    const label = splitLabel.length === 2 ? splitLabel[1] : undefined;
    return new UserMentionSection({ userId, label });
  }

  if (extractedValue.startsWith('!subteam^')) {
    const splitLabel = extractedValue.split('|');
    const userGroupId = splitLabel[0].substring(9);
    const label = splitLabel.length === 2 ? splitLabel[1] : undefined;
    return new UserGroupMentionSection({ userGroupId, label });
  }

  if (extractedValue.startsWith('!date^')) {
    const splitFallback = extractedValue.split('|');
    const dateFmt = splitFallback[0].substring(6);

    const splitDateFmt = dateFmt.split('^');
    const unix = parseInt(splitDateFmt[0], 10);
    const format = splitDateFmt[1];
    const optionalLink =
      splitDateFmt.length === 3 ? splitDateFmt[2] : undefined;

    const fallback = splitFallback.length === 2 ? splitFallback[1] : undefined;
    return new LocalizedDateSection({ unix, format, optionalLink, fallback });
  }

  if (extractedValue.startsWith('!')) {
    const splitLabel = extractedValue.split('|');
    const mention = splitLabel[0].substring(1);
    const label = splitLabel.length === 2 ? splitLabel[1] : undefined;
    if (mention === 'channel' || mention === 'everyone' || mention === 'here') {
      return new SpecialMentionSection({ mention, label });
    }
    return new SpecialMentionSection({ label });
  }

  const splitLabel = extractedValue.split('|');
  const url = splitLabel[0];
  const label = splitLabel.length === 2 ? splitLabel[1] : undefined;
  return new UrlLinkSection({ url, label });
}
