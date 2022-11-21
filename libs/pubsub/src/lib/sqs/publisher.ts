import { Endpoint, SQS } from 'aws-sdk';
import { logger } from '@base/logger';
import * as path from 'path';
import { Publisher } from '../types';
import { SqsConfig } from './types';

export class SqsPublisher implements Publisher {
  private client: SQS;
  constructor(private cfg: SqsConfig) {
    this.client = new SQS({
      region: cfg.region,
      endpoint: new Endpoint(cfg.baseUrl),
    });
  }

  async publish(queue: string, event: Record<string, unknown>): Promise<void> {
    const queueUrl = this.createSqsUrl(queue);
    logger.debug({ message: `Sending to ${queueUrl}` });

    try {
      const data = await new Promise<SQS.SendMessageResult>(
        (resolve, reject) => {
          this.client.sendMessage(
            {
              MessageBody: JSON.stringify(event),
              QueueUrl: queueUrl,
            },
            (err, data) => {
              if (err) {
                reject(err);
              } else {
                resolve(data);
              }
            },
          );
        },
      );
      logger.debug({ msg: 'published message to sqs', data: data });
    } catch (error) {
      logger.error({
        msg: `error in publishing message to sqs`,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  private createSqsUrl(queue: string) {
    const url = new URL(this.cfg.baseUrl);
    url.pathname = path.join(this.cfg.accountId, queue);
    return url.toString();
  }
}
