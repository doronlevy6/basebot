import { Task, User } from '@base/oapigen';
import { TaskStatusTriggerer } from './triggerer_tester';
// TODO remove function
export const runTestExample = async (
  taskStatusTriggerer: TaskStatusTriggerer,
) => {
  if (!['development', 'local'].includes(process.env.ENV || 'local')) {
    console.log(`skipping test status message in env ${process.env.ENV}`);
    return;
  }

  const assignee1: User = {
    id: 'zsuo1hyz4cxqk271u649g',
    email: 'itay@base.la',
    organizationId: 'base.la',
    displayName: 'Itay',
    externalAuthId: '',
    createdAt: new Date().toString(),
    updatedAt: new Date().toString(),
    profileImage: '',
  };

  const creator = {
    id: 'lowpi01g4l6288euibxgx',
    email: 'coby@base.la',
    organizationId: 'base.la',
    displayName: 'Coby',
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
    id: '9n145fst1k0wu0kep5owh',
    creator: creator,
    creatorId: creator.id,
    title: 'This is some task!',
    dueDate: new Date().toString(),
    assigneeId: assignee1.id,
    status: 'in_progress',
    links: ['http://www.walla.co.il', 'http://www.gmail.com'],
  } as unknown as Task;

  // for (let i = 0; i < 5; i++) {
  //   await taskStatusTriggerer.addTaskToQueue(assignee1, task);
  await taskStatusTriggerer.addTaskToQueue(assignee1, task, true);
  //   // await taskStatusTriggerer.addTaskToQueue(assignee3, task);
  // }
};

export const runDebugMessage = async () => {
  console.log('Starting debug message');

  const allQueueCfg = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    cluster: process.env.REDIS_CLUSTER === 'true',
    prefix: `{base:queues:${process.env.ENV || 'local'}}`,
  };

  const taskStatusTriggerer = new TaskStatusTriggerer(allQueueCfg);
  runTestExample(taskStatusTriggerer);
};
