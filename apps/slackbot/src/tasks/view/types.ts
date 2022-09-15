import { Task } from '@base/oapigen';

export enum AcknowledgementStatus {
  Acknowledged = 'acknowledged',
  Declined = 'declined',
}

export interface ITaskViewProps {
  assignee: {
    id: string;
  };
  owner?: {
    id: string;
  };
  creator: {
    id: string;
  };
  baseUserId: string;
  baseOrgId: string;
  task: Task;
  acknowledgementStatus?: AcknowledgementStatus;
  extraCollaterals?: string[];
}
