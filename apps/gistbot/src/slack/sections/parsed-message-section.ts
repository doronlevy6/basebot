import { ChannelLinkSection } from './channel-link-section';
import { LocalizedDateSection } from './localized-date-section';
import { SpecialMentionSection } from './special-mention-section';
import { TextSection } from './text-section';
import { UrlLinkSection } from './url-link-section';
import { UserGroupMentionSection } from './user-group-mention-section';
import { UserMentionSection } from './user-mention-section';

export type ParsedMessageSection =
  | TextSection
  | ChannelLinkSection
  | UserMentionSection
  | UserGroupMentionSection
  | SpecialMentionSection
  | LocalizedDateSection
  | UrlLinkSection;
