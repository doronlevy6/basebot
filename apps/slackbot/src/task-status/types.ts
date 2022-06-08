export enum TaskStatus {
  Reassigned = 'Reassigned to someone else',
  NotStarted = 'Not started',
  InProgress = 'In Progress',
  Done = 'Done',
}

export const TaskStatuses = [
  TaskStatus.Reassigned,
  TaskStatus.NotStarted,
  TaskStatus.InProgress,
  TaskStatus.Done,
];
