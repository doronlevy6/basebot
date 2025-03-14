import { Task } from '@base/oapigen';
import * as day from 'dayjs';

export enum UserTaskRole {
  creatorAndOwner,
  creator,
  owner,
  contributor,
}

export const formatDate = (date: Date | string): string => {
  const dayDate = day(date);
  return dayDate.format('MMM D YYYY');
};

export const formatDaysOrWeeksUntil = (
  now: Date,
  until: Date | string,
): string => {
  const dayDateNow = day(now);
  const dayDateUntil = day(until);

  const diffInDays = Math.round(dayDateUntil.diff(dayDateNow, 'day', true));
  if (diffInDays < 11) {
    let suffix = '';
    if (diffInDays > 1) {
      suffix = 's';
    }
    return `${diffInDays} day${suffix}`;
  }

  const diffInWeeks = dayDateUntil.diff(dayDateNow, 'week', true);

  return `${Math.round(diffInWeeks)} weeks`;
};

export const snakeToTitleCase = (str: string): string => {
  return delimToTitleCase(str, '_', ' ');
};

export const delimToTitleCase = (
  str: string,
  splitDelim: string,
  joinDelim: string,
): string => {
  return str
    .split(splitDelim)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(joinDelim);
};

export const checkUserTaskRole = (userId: string, task: Task): UserTaskRole => {
  if (userId === task.creatorId && userId === task.ownerId) {
    return UserTaskRole.creatorAndOwner;
  } else if (userId === task.creatorId) {
    return UserTaskRole.creator;
  } else if (userId === task.ownerId) {
    return UserTaskRole.owner;
  } else {
    return UserTaskRole.contributor;
  }
};
