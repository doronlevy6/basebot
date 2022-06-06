import { Request, Response, NextFunction, RequestHandler } from 'express';
import { IReporter } from './reporter';

interface middleware {
  (req: Request, res: Response, next: NextFunction): void;
}

export const expressMetricsEndpoint: (reporter: IReporter) => RequestHandler =
  (reporter) => async (_, res) => {
    const currentMetrics = await reporter.currentMetricsState();
    res.contentType('text/plain; charset=utf-8');
    res.send(currentMetrics);
  };

export const expressHttpMetricsMiddleware: (
  reporter: IReporter,
) => middleware = (reporter) => {
  reporter.registerGauge(
    'in_progress_http_requests',
    'The number of HTTP requests currently in progress',
    ['path', 'method'],
  );

  reporter.registerCounter(
    'http_requests_total',
    'The number of HTTP requests that have happened',
    ['path', 'method', 'code'],
  );

  reporter.registerHistogram(
    'http_request_latency',
    'The latency of HTTP requests processed by the server',
    ['path', 'method', 'code'],
  );

  return async (req, res, next) => {
    const start = new Date();
    const { path, method } = req;
    reporter.incGauge('in_progress_http_requests', { path, method });

    res.once('finish', () => {
      reporter.decGauge('in_progress_http_requests', { path, method });
      reporter.incrementCounter('http_requests_total', 1, {
        path,
        method,
        code: res.statusCode,
      });
      reporter.recordHistogramDuration('http_request_latency', start, {
        path,
        method,
        code: res.statusCode,
      });
    });

    next();
  };
};
