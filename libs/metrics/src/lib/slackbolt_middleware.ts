import { Middleware, AnyMiddlewareArgs } from '@slack/bolt';
import { IReporter } from './reporter';

export const slackBoltMetricsMiddleware: (
  reporter: IReporter,
) => Middleware<AnyMiddlewareArgs> = (reporter) => {
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

  return async ({ next }) => {
    const start = new Date();
    const path = '/events';
    const method = 'GET';
    reporter.incGauge('in_progress_http_requests', { path, method });

    let statusCode = 200;
    try {
      await next();
    } catch (error) {
      statusCode = 500;
    }

    reporter.decGauge('in_progress_http_requests', { path, method });
    reporter.incrementCounter('http_requests_total', 1, {
      path,
      method,
      code: statusCode,
    });

    reporter.recordHistogramDuration('http_request_latency', start, {
      path,
      method,
      code: statusCode,
    });
  };
};
