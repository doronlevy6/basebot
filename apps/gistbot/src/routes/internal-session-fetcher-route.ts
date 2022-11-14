import { logger } from '@base/logger';
import { CustomRoute } from '@slack/bolt';
import {
  InternalSessionFetcher,
  SessionFetchRequest,
} from '../summaries/session-data/internal-fetcher';

export const internalSessionFetcherRoute = (
  apiKey: string,
  fetcher: InternalSessionFetcher,
): CustomRoute => ({
  path: '/internal/feedback/fetch',
  method: ['POST'],
  // The signature here should allow an async function and it is handled correctly internally
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  handler: async (req, res) => {
    if (!req.headers.authorization) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    if (req.headers.authorization !== `Bearer: ${apiKey}`) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'forbidden' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const parsedReq = parseRequest(body);
      if (!parsedReq) {
        res.statusCode = 422;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'unprocessable entity' }));
        return;
      }

      fetcher
        .handleRequest(parsedReq)
        .then((session) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(session));
        })
        .catch((error) => {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error }));
        });
    });
  },
});

const parseRequest = (req: string): SessionFetchRequest | undefined => {
  try {
    const jsonReq = JSON.parse(req) as SessionFetchRequest;
    if (jsonReq.sessionId === undefined || jsonReq.teamId === undefined) {
      throw new Error('request is not complete');
    }
    return jsonReq;
  } catch (error) {
    logger.error({
      msg: `error in parseRequest on internal session fetcher route`,
      error: error.message,
      stack: error.stack,
    });
    return;
  }
};
