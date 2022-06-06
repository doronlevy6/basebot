// IReporter is a replication of our metrics.Reporter interface from Go.
export interface IReporter {
  // Collect and return current state of the metrics
  currentMetricsState: () => Promise<string>;

  // Registration functions to register on our metrics registry
  registerCounter: (name: string, doc: string, labels: string[]) => void;
  registerGauge: (name: string, doc: string, labels: string[]) => void;
  registerHistogram: (name: string, doc: string, labels: string[]) => void;

  // Updating values in metrics
  incrementCounter: (
    name: string,
    amount: number,
    labels: { [key: string]: string | number },
  ) => void;
  setGauge: (
    name: string,
    value: number,
    labels: { [key: string]: string | number },
  ) => void;
  incGauge: (name: string, labels: { [key: string]: string | number }) => void;
  decGauge: (name: string, labels: { [key: string]: string | number }) => void;
  addToGauge: (
    name: string,
    amount: number,
    labels: { [key: string]: string | number },
  ) => void;
  subFromGauge: (
    name: string,
    amount: number,
    labels: { [key: string]: string | number },
  ) => void;
  recordHistogramDuration: (
    name: string,
    startedAt: Date,
    labels: { [key: string]: string | number },
  ) => void;
  recordHistogramValue: (
    name: string,
    value: number,
    labels: { [key: string]: string | number },
  ) => void;

  // Default metrics
  error: (context: string, step: string) => void;
  flow: (context: string, step: string, startedAt: Date) => void;
}
