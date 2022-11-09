import { Endpoint, SQS } from 'aws-sdk';
import { logger } from '@base/logger';
import * as path from 'path';
import { SqsConfig } from './types';

class Deferred {
  promise: Promise<void>;
  resolve: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject: (reason?: any) => void;

  constructor() {
    this.promise = new Promise<void>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

export class SqsConsumer {
  private client: SQS;
  private stopped: boolean;
  private stoppedWait: Deferred;
  constructor(
    private cfg: SqsConfig,
    private consumeFunc: (msg: Record<string, unknown>) => Promise<boolean>,
  ) {
    this.client = new SQS({
      region: cfg.region,
      endpoint: new Endpoint(cfg.baseUrl),
    });
    this.stopped = false;
    this.stoppedWait = new Deferred();
  }

  start(queue: string): void {
    const queueUrl = this.createSqsUrl(queue);
    logger.debug({ message: `Consuming from ${queueUrl}` });
    this.stopped = false;
    this.pollSqsMessages(queueUrl);
  }

  async stop() {
    this.stopped = true;
    logger.debug(`stopping sqs consumer`);
    await this.stoppedWait.promise;
  }

  private pollSqsMessages(queueUrl: string) {
    this.consume(queueUrl).then(() => {
      if (this.stopped) {
        this.stoppedWait.resolve();
        return;
      }
      setTimeout(() => this.pollSqsMessages(queueUrl));
    });
  }

  private async consume(queueUrl: string): Promise<void> {
    try {
      const messages = await new Promise<SQS.Message[]>((resolve, reject) => {
        this.client.receiveMessage(
          {
            AttributeNames: ['SentTimestamp'],
            MaxNumberOfMessages: 10,
            MessageAttributeNames: ['All'],
            QueueUrl: queueUrl,
            VisibilityTimeout: 20,
            WaitTimeSeconds: 0,
          },
          (error, data) => {
            if (error) {
              reject(error);
              return;
            }

            if (!data.Messages || data.Messages.length === 0) {
              resolve([]);
              return;
            }

            resolve(data.Messages);
          },
        );
      });

      const runningMessages = messages.map(async (msg): Promise<void> => {
        if (!msg.Body) {
          return Promise.resolve();
        }

        try {
          const record = JSON.parse(msg.Body) as Record<string, unknown>;
          const success = await this.consumeFunc(record);

          if (msg.ReceiptHandle && success) {
            await this.deleteMessage(queueUrl, msg.ReceiptHandle);
          }

          if (!success) {
            throw new Error('consumer function returned success=false');
          }
        } catch (error) {
          logger.error({
            msg: `error in running consumer function on message from sqs`,
            error: error.message,
            stack: error.stack,
          });
        }
      });

      await Promise.all(runningMessages);
    } catch (error) {
      logger.error({
        msg: `error in receiving messages from sqs`,
        error: error.message,
        stack: error.stack,
      });
    }
  }

  private async deleteMessage(queueUrl: string, receiptHandle: string) {
    return new Promise<void>((resolve, reject) => {
      this.client.deleteMessage(
        {
          QueueUrl: queueUrl,
          ReceiptHandle: receiptHandle,
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (error, data) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        },
      );
    });
  }

  private createSqsUrl(queue: string) {
    const url = new URL(this.cfg.baseUrl);
    url.pathname = path.join(this.cfg.accountId, queue);
    return url.toString();
  }
}
