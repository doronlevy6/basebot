import { logger } from '@base/logger';
import { Task, User } from '@base/oapigen';
import { TaskStatusTriggerer } from './triggerer_tester';
// TODO remove function
export const runTestExample = async (
  taskStatusTriggerer: TaskStatusTriggerer,
) => {
  if (!['development', 'local'].includes(process.env.ENV || 'local')) {
    logger.info(`skipping test status message in env ${process.env.ENV}`);
    return;
  }

  const assignee1: User = {
    id: '08f041ca-ea52-49a4-954b-ad936bf65453',
    email: 'coby@base.la',
    organizationId: 'base.la',
    displayName: 'Coby',
    externalAuthId: '',
    createdAt: new Date().toString(),
    updatedAt: new Date().toString(),
    profileImage: '',
  };

  const creator = {
    id: 'u_itay',
    email: 'itay@base.la',
    organizationId: 'base.la',
    displayName: 'Itay',
    organization: undefined,
    externalAuthId: '',
    profileImage: '',
  };
  // const assignee2: User = {
  //   id: '5ec77a68-fc4e-4085-a5e8-6a50ee44ead1',
  //   email: 'lior@base.la',
  //   organizationId: 'base.la',
  //   displayName: 'Lior',
  //   externalAuthId: '',
  //   profileImage: '',
  //   createdAt: new Date().toString(),
  //   updatedAt: new Date().toString(),
  // };
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
    dueDate: new Date().toString(),
    assigneeId: '08f041ca-ea52-49a4-954b-ad936bf65453',
    status: 'in progress',
    links: ['http://www.walla.co.il', 'http://www.gmail.com'],
  } as unknown as Task;

  // for (let i = 0; i < 5; i++) {
  //   await taskStatusTriggerer.addTaskToQueue(assignee1, task);
  await taskStatusTriggerer.addTaskToQueue(assignee1, task);
  //   // await taskStatusTriggerer.addTaskToQueue(assignee3, task);
  // }
};
