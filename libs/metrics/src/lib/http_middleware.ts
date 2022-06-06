import { RequestListener } from 'http';
import { IReporter } from './reporter';

export const httpMetricsEndpoint: (reporter: IReporter) => RequestListener =
  (reporter) => async (_, res) => {
    const currentMetrics = await reporter.currentMetricsState();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(currentMetrics);
  };
