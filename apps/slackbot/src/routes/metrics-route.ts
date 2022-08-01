import { CustomRoute } from '@slack/bolt';
import { httpMetricsEndpoint, IReporter } from '@base/metrics';

export const metricsRoute = (metricsReporter: IReporter): CustomRoute => ({
  path: '/metrics',
  method: ['GET'],
  handler: httpMetricsEndpoint(metricsReporter),
});
