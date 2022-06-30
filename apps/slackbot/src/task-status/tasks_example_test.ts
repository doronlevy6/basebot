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
  //     createdAt: new Date().toString(),
  //     updatedAt: new Date().toString(),
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
    id: '5ec77a68-fc4e-4085-a5e8-6a50ee44ead1',
    email: 'lior@base.la',
    organizationId: 'base.la',
    displayName: 'Lior',
    externalAuthId: '',
    profileImage: '',
    createdAt: new Date().toString(),
    updatedAt: new Date().toString(),
  };
  // const assignee3 = {
  //     id: 'u_amir',
  //     email: 'amir@base.la',
  //     organizationId: 'base.la',
  //     displayName: 'Amir',
  //     organization: undefined,
  //     externalAuthId: '',
  //     createdAt: new Date().toString(),
  //     updatedAt: new Date().toString(),
  // };

  const task = {
    id: '1',
    creator: creator,
    creatorId: creator.id,
    title: 'This is some task!',
    dueDate: 'Tomorrow',
    assigneeId: '5ec77a68-fc4e-4085-a5e8-6a50ee44ead1',
    status: 'in progress',
    links: ['http://www.walla.co.il', 'http://www.gmail.com'],
  } as unknown as Task;

  // for (let i = 0; i < 5; i++) {
  //   await taskStatusTriggerer.addTaskToQueue(assignee1, task);
  await taskStatusTriggerer.addTaskToQueue(assignee2, task);
  //   // await taskStatusTriggerer.addTaskToQueue(assignee3, task);
  // }
};
