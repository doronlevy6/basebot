import { CustomRoute } from '@slack/bolt';

export const healthRoute = (): CustomRoute => ({
  path: '/health',
  method: ['GET'],
  // The signature here should allow an async function and it is handled correctly internally
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  handler: async (_, res) => {
    res.writeHead(200);
    const healthRes = {
      status: 'ok',
      info: {
        serviceInfo: {
          status: 'up',
          env: process.env.ENV,
          version: process.env.VERSION,
          tag: process.env.TAG,
        },
      },
      error: {},
      details: {
        serviceInfo: {
          status: 'up',
          env: process.env.ENV,
          version: process.env.VERSION,
          tag: process.env.TAG,
        },
      },
    };
    res.end(JSON.stringify(healthRes));
  },
});
