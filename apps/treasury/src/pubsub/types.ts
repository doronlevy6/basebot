export interface Publisher {
  publish(queue: string, event: Record<string, unknown>): Promise<void>;
}

export interface SqsConfig {
  region: string;
  baseUrl: string;
  accountId: string;
}
