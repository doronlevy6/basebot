export interface Publisher {
  publish(queue: string, event: Record<string, unknown>): Promise<void>;
}

export interface Consumer {
  start(queueUrl: string): void;
}

export class Deferred {
  promise: Promise<void>;
  resolve!: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject!: (reason?: any) => void;

  constructor() {
    this.promise = new Promise<void>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}
