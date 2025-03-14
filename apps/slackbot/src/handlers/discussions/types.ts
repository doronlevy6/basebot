export interface IAddDiscussionPrivateMetadata {
  messageTs: string;
  channelId: string;
  teamId?: string;
  messageCreatorId: string;
  shortcutActorEmail: string;
  rawText: string;
}

export const ADD_DISCUSSION_TASK_ID = 'add-discussion-task';
