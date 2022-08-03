export interface IMessageIdetifier {
  messageTs: string;
  channelId: string;
}

export interface ITaskIdentifier {
  organizationId: string;
  assigneeId: string;
  taskId: string;
}

export interface IModalMetadata extends IMessageIdetifier, ITaskIdentifier {}
