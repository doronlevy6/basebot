export interface ImportJobMetadata {
  token: string;
  slackTeamId: string;
  slackTeamEmailDomains: string[];
}

export interface ImportJob {
  metadata: ImportJobMetadata;
  cursor?: string;
  type: ImportTaskType;
}

export enum ImportTaskType {
  Users = 'users',
}
