import { Task, User } from '@base/oapigen';
import { TaskStatusTriggerer } from './triggerer_tester';
// TODO remove function
export const runTestExample = async (
  taskStatusTriggerer: TaskStatusTriggerer,
) => {
  // const assignee1 = {
  //     id: 'u_coby',
  //     email: 'coby@base.la',
  //     organizationId: 'base.la',
  //     displayName: 'Coby',
  //     organization: undefined,
  //     externalAuthId: '',
  // };

  const creator = {
    id: 'u_itay',
    email: 'itay@base.la',
    organizationId: 'base.la',
    displayName: 'Itay',
    organization: undefined,
    externalAuthId: '',
    profileImage: '',
  };
  const assignee2: User = {
    id: '7f155beb-3fc1-4d9c-bb32-367075525dd8',
    email: 'lior@base.la',
    organizationId: 'base.la',
    displayName: 'Lior',
    externalAuthId: '',
    profileImage: '',
  };
  // const assignee3 = {
  //     id: 'u_amir',
  //     email: 'amir@base.la',
  //     organizationId: 'base.la',
  //     displayName: 'Amir',
  //     organization: undefined,
  //     externalAuthId: '',
  // };

  const task = {
    id: '3',
    creator: creator,
    creatorId: creator.id,
    title: 'This is some task!',
    dueDate: 'Tomorrow',
    assigneeId: '7f155beb-3fc1-4d9c-bb32-367075525dd8',
    status: 'in progress',
  } as unknown as Task;

  // for (let i = 0; i < 5; i++) {
  //   await taskStatusTriggerer.addTaskToQueue(assignee1, task);
  await taskStatusTriggerer.addTaskToQueue(assignee2, task);
  //   // await taskStatusTriggerer.addTaskToQueue(assignee3, task);
  // }
};
