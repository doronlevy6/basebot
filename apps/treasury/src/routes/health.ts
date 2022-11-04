import { Request, Response } from 'express';

export const healthRoute = () => async (_req: Request, res: Response) => {
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
};
