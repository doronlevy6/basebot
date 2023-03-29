import { IReporter } from './reporter';
import { logger } from '@base/logger';
import * as promclient from 'prom-client';

export class PrometheusReporter implements IReporter {
  private registry: promclient.Registry;
  private counters: { [key: string]: promclient.Counter<string> };
  private gauges: { [key: string]: promclient.Gauge<string> };
  private histograms: { [key: string]: promclient.Histogram<string> };

  constructor() {
    this.registry = new promclient.Registry();
    this.counters = {};
    this.gauges = {};
    this.histograms = {};
    promclient.collectDefaultMetrics({
      register: this.registry,
    });

    this.registerCounter(
      'errors_total',
      'An errors counter to record errors in the service',
      ['context', 'step'],
    );

    this.registerHistogram(
      'flow',
      'Flow metrics to track latencies across different steps',
      ['context', 'step'],
    );
  }

  public async currentMetricsState(): Promise<string> {
    return this.registry.metrics();
  }

  public registerCounter(name: string, doc: string, labels: string[]): void {
    if (this.counters[name]) {
      return;
    }

    const counter = new promclient.Counter({
      name,
      help: doc,
      labelNames: labels,
      registers: [this.registry],
    });

    this.counters[name] = counter;
  }

  public registerGauge(name: string, doc: string, labels: string[]): void {
    if (this.gauges[name]) {
      return;
    }

    const gauge = new promclient.Gauge({
      name,
      help: doc,
      labelNames: labels,
      registers: [this.registry],
    });

    this.gauges[name] = gauge;
  }

  public registerHistogram(name: string, doc: string, labels: string[]): void {
    if (this.histograms[name]) {
      return;
    }

    const histogram = new promclient.Histogram({
      name,
      help: doc,
      labelNames: labels,
      registers: [this.registry],
      buckets: [
        0.001, 0.002, 0.005, 0.007, 0.01, 0.015, 0.02, 0.025, 0.03, 0.04, 0.05,
        0.06, 0.07, 0.08, 0.09, 0.1, 0.2, 0.3, 0.4, 0.5, 1.0, 2.0, 5.0, 10.0,
        30.0, 60.0, 90.0, 120.0, 150.0, 180.0, 210.0, 240.0, 270.0, 300.0,
        330.0, 360.0, 390.0, 420.0, 450.0, 480.0, 510.0, 540.0, 570.0, 600.0,
      ],
    });

    this.histograms[name] = histogram;
  }

  public incrementCounter(
    name: string,
    amount: number,
    labels: { [key: string]: string | number },
  ): void {
    if (!this.counters[name]) {
      logger.error(`unknown counter with name ${name}`);
      return;
    }

    this.counters[name].inc(labels, amount);
  }

  public setGauge(
    name: string,
    value: number,
    labels: { [key: string]: string | number },
  ): void {
    if (!this.gauges[name]) {
      logger.error(`unknown gauge with name ${name}`);
      return;
    }

    this.gauges[name].set(labels, value);
  }

  public incGauge(
    name: string,
    labels: { [key: string]: string | number },
  ): void {
    if (!this.gauges[name]) {
      logger.error(`unknown gauge with name ${name}`);
      return;
    }

    this.gauges[name].inc(labels);
  }

  public decGauge(
    name: string,
    labels: { [key: string]: string | number },
  ): void {
    if (!this.gauges[name]) {
      logger.error(`unknown gauge with name ${name}`);
      return;
    }

    this.gauges[name].dec(labels);
  }

  public addToGauge(
    name: string,
    amount: number,
    labels: { [key: string]: string | number },
  ): void {
    if (!this.gauges[name]) {
      logger.error(`unknown gauge with name ${name}`);
      return;
    }

    this.gauges[name].inc(labels, amount);
  }

  public subFromGauge(
    name: string,
    amount: number,
    labels: { [key: string]: string | number },
  ): void {
    if (!this.gauges[name]) {
      logger.error(`unknown gauge with name ${name}`);
      return;
    }

    this.gauges[name].dec(labels, amount);
  }

  public recordHistogramDuration(
    name: string,
    startedAt: Date,
    labels: { [key: string]: string | number },
  ): void {
    if (!this.histograms[name]) {
      logger.error(`unknown histogram with name ${name}`);
      return;
    }

    const now = new Date();
    const seconds = (startedAt.getTime() - now.getTime()) / 1000;
    this.histograms[name].observe(labels, seconds);
  }

  public recordHistogramValue(
    name: string,
    value: number,
    labels: { [key: string]: string | number },
  ): void {
    if (!this.histograms[name]) {
      logger.error(`unknown histogram with name ${name}`);
      return;
    }

    this.histograms[name].observe(labels, value);
  }

  public error(context: string, step: string, team?: string): void {
    this.incrementCounter('errors_total', 1, {
      context,
      step,
      team: team || 'unknown',
    });
  }

  public flow(context: string, step: string, startedAt: Date): void {
    this.recordHistogramDuration('flow', startedAt, { context, step });
  }
}
