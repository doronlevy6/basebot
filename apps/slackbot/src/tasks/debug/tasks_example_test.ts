import { Task, User } from '@base/oapigen';
import { TriggerTester } from './triggerer_tester';
// TODO remove function
export const runTestExample = async (triggerTester: TriggerTester) => {
  if (!['development', 'local'].includes(process.env.ENV || 'local')) {
    console.log(`skipping test status message in env ${process.env.ENV}`);
    return;
  }

  // const assignee1: User = {
  //   id: 'zsuo1hyz4cxqk271u649g',
  //   email: 'itay@base.la',
  //   organizationId: 'base.la',
  //   displayName: 'Itay',
  //   externalAuthId: '',
  //   createdAt: new Date().toString(),
  //   updatedAt: new Date().toString(),
  //   profileImage: '',
  // };
  const assignee2: User = {
    id: 'vplipbpvetug00ct0k3a5',
    organizationId: 'base.la',
    externalAuthId: 'google-oauth2|115235453267616289442',
    email: 'lior@base.la',
    displayName: 'Lior Nussbaum',
    profileImage:
      'https://avatars.slack-edge.com/2021-12-26/2907466138016_9079261c8bb67bca883c_512.png',
    createdAt: '2022-09-13T12:41:29.987Z',
    updatedAt: '2022-09-13T12:41:29.987Z',
  };

  const task2: Task = {
    id: 'hlivcswko63w6g27noec0',
    creatorId: 'vplipbpvetug00ct0k3a5',
    ownerId: 'vplipbpvetug00ct0k3a5',
    title: 'Test8',
    status: 'not_started',
    description: '',
    createdAt: '2022-09-13T15:22:11.240Z',
    updatedAt: '2022-09-13T15:22:11.240Z',
    dueDate: '',
    deletedAt: '',
    creator: {
      id: 'vplipbpvetug00ct0k3a5',
      organizationId: 'base.la',
      externalAuthId: 'google-oauth2|115235453267616289442',
      email: 'lior@base.la',
      displayName: 'Lior Nussbaum',
      profileImage:
        'https://avatars.slack-edge.com/2021-12-26/2907466138016_9079261c8bb67bca883c_512.png',
      createdAt: '2022-09-13T12:41:29.987Z',
      updatedAt: '2022-09-13T12:41:29.987Z',
    },
    owner: {
      id: 'vplipbpvetug00ct0k3a5',
      organizationId: 'base.la',
      externalAuthId: 'google-oauth2|115235453267616289442',
      email: 'lior@base.la',
      displayName: 'Lior Nussbaum',
      profileImage:
        'https://avatars.slack-edge.com/2021-12-26/2907466138016_9079261c8bb67bca883c_512.png',
      createdAt: '2022-09-13T12:41:29.987Z',
      updatedAt: '2022-09-13T12:41:29.987Z',
    },
    contributors: [
      {
        id: 'zn5oovynuntmsj38ndd5c',
        organizationId: 'base.la',
        externalAuthId: '',
        email: 'itay@base.la',
        displayName: 'Itay Dressler',
        profileImage:
          'https://avatars.slack-edge.com/2021-12-20/2874814678129_22cb21074b7d49226585_512.jpg',
        createdAt: '2022-09-13T12:43:23.664Z',
        updatedAt: '2022-09-13T12:43:23.664Z',
      },
      {
        id: 'cjhau4a0fcrr9paks4ibr',
        organizationId: 'base.la',
        externalAuthId: '',
        email: 'coby@base.la',
        displayName: 'Coby Benveniste',
        profileImage:
          'https://avatars.slack-edge.com/2021-12-26/2868886783847_6c3ffb6679f42356f017_512.png',
        createdAt: '2022-09-13T12:43:23.664Z',
        updatedAt: '2022-09-13T12:43:23.664Z',
      },
      {
        id: 'tmkd7dkq274tr0iu3066g',
        organizationId: 'base.la',
        externalAuthId: '',
        email: 'moran@base.la',
        displayName: 'Moran Shimron',
        profileImage:
          'https://secure.gravatar.com/avatar/497d294fbf3f9c36947e049846a8d7d4.jpg?s=512&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0021-512.png',
        createdAt: '2022-09-13T12:43:23.664Z',
        updatedAt: '2022-09-13T12:43:23.664Z',
      },
      {
        id: 'vplipbpvetug00ct0k3a5',
        organizationId: 'base.la',
        externalAuthId: 'google-oauth2|115235453267616289442',
        email: 'lior@base.la',
        displayName: 'Lior Nussbaum',
        profileImage:
          'https://avatars.slack-edge.com/2021-12-26/2907466138016_9079261c8bb67bca883c_512.png',
        createdAt: '2022-09-13T12:41:29.987Z',
        updatedAt: '2022-09-13T12:41:29.987Z',
      },
    ],
    contributorsIds: [
      'cjhau4a0fcrr9paks4ibr',
      'tmkd7dkq274tr0iu3066g',
      'vplipbpvetug00ct0k3a5',
      'zn5oovynuntmsj38ndd5c',
    ],
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // const task = {
  //   id: '9n145fst1k0wu0kep5owh',
  //   creator: creator,
  //   creatorId: creator.id,
  //   title: 'This is some task!',
  //   dueDate: new Date().toString(),
  //   assigneeId: assignee1.id,
  //   status: 'in_progress',
  //   links: ['http://www.walla.co.il', 'http://www.gmail.com'],
  // } as unknown as Task;

  // for (let i = 0; i < 5; i++) {
  //   await taskStatusTriggerer.addTaskToQueue(assignee1, task);
  await triggerTester.addTaskToQueue(assignee2, task2, true);
  await triggerTester.addNudgeToQueue({
    comment: 'hi',
    taskId: task2.id,
    userToNudgeEmail: assignee2.email,
    actionUserEmail: creator.email,
    organizationId: assignee2.organizationId,
  });
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

  const taskStatusTriggerer = new TriggerTester(allQueueCfg);
  await runTestExample(taskStatusTriggerer);
};
