import { Request, Response, RequestHandler, NextFunction } from 'express';

export const healthRoute =
  (): RequestHandler =>
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
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
    } catch (error) {
      next(error);
    }
  };
