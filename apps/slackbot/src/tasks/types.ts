import { MessageBlocks } from './manager';

export interface SlackMessageSenderMetadata {
  organizationId: string;
  userEmail?: string;
  channelId: string;
  text: string;
  blocks: MessageBlocks[];
}
