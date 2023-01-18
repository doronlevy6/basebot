import { Logger, ConsoleLogger, LogLevel } from '@slack/logger';
import {
  App,
  Receiver,
  ReceiverEvent,
  ReceiverMultipleAckError,
} from '@slack/bolt';
import { Consumer, SqsConfig, SqsConsumer } from '@base/pubsub';
import * as querystring from 'querystring';
import { delay } from '../utils/retry';

export interface AwsSQSReceiverOptions {
  sqsConfig: SqsConfig;
  sqsQueueName: string;
  logger?: Logger;
  logLevel?: LogLevel;
}

interface SQSEvent extends Record<string, unknown> {
  body: string;
  headers?: Record<string, string>;
  isBase64Encoded?: boolean;
}

class AckWithBodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/*
 * Receiver implementation for an app that listens to events via AWS SQS.
 * Most of this receiver was copied directly from Bolt's implementation of the AwsLambdaReceiver
 * found here: https://github.com/slackapi/bolt-js/blob/main/src/receivers/AwsLambdaReceiver.ts.
 *
 * This receiver is implemented asynchronously, meaning that we cannot respond to Slack
 * within the `ack` function. The `ack` function must be handled via a separate receiver,
 * which will receive the event, verify it, ack it, and forward the entire event to an SQS queue.
 *
 * Note that this receiver does not support Slack OAuth flow.
 * For OAuth flow endpoints, deploy another Lambda function built with ExpressReceiver.
 */
export default class AwsSQSReceiver implements Receiver {
  private app?: App;
  private sqsConsumer: SqsConsumer;
  private logger: Logger;
  private sqsQueueName: string;
  private sqsConfig: SqsConfig;

  public constructor({
    sqsConfig,
    sqsQueueName,
    logger = undefined,
    logLevel = LogLevel.INFO,
  }: AwsSQSReceiverOptions) {
    // Initialize instance variables, substituting defaults for each value
    this.sqsConfig = sqsConfig;
    this.sqsQueueName = sqsQueueName;
    this.sqsConsumer = new SqsConsumer(this.sqsConfig, (msg) => {
      return this.consume(msg);
    });

    this.logger =
      logger ??
      (() => {
        const defaultLogger = new ConsoleLogger();
        defaultLogger.setLevel(logLevel);
        return defaultLogger;
      })();
  }

  public init(app: App): void {
    this.app = app;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  public start(..._args: any[]): Promise<Consumer> {
    return new Promise((resolve, reject) => {
      try {
        this.sqsConsumer.start(this.sqsQueueName);
        resolve(this.sqsConsumer);
      } catch (error) {
        reject(error);
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  public stop(..._args: any[]): Promise<void> {
    return this.sqsConsumer.stop();
  }

  public async consume(sqsEvent: Record<string, unknown>): Promise<boolean> {
    this.logger.debug(`Raw event: ${JSON.stringify(sqsEvent, null, 2)}`);

    if (!this.validateSqsEvent(sqsEvent)) {
      this.logger.error({ msg: `invalid sqs event`, event: sqsEvent });
      return true; // true because we want to ack since it's invalid, no use retrying
    }

    const rawBody = this.getRawBody(sqsEvent);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = this.parseRequestBody(
      rawBody,
      this.getHeaderValue(sqsEvent.headers, 'Content-Type'),
      this.logger,
    );

    // gist_delay check (for detecting forced delay messages)
    // This will let us force a delay on the message to test scaling policies.
    if (
      typeof body !== 'undefined' &&
      body != null &&
      typeof body.gist_delay !== 'undefined' &&
      body.gist_delay != null &&
      typeof body.gist_delay === 'number'
    ) {
      this.logger.info(
        `Received delay message, delaying for ${body.gist_delay} milliseconds`,
      );
      await delay(body.gist_delay);
      return true;
    }

    // ssl_check (for Slash Commands)
    if (
      typeof body !== 'undefined' &&
      body != null &&
      typeof body.ssl_check !== 'undefined' &&
      body.ssl_check != null
    ) {
      // ssl_check will be handled by the synchronous receiver instead of this one.
      return true;
    }

    // We explicitly skip the signature verification.
    // Since the SQS receiver is asynchronous, we cannot return a 401 to the client,
    // so the verification should be at the level of the receiver that forwards the
    // requests to SQS as opposed to at the level of the SQS receiver.
    // If we want to implement this at the SQS level as well in the future, we should insert it here.

    // url_verification (Events API)
    if (
      typeof body !== 'undefined' &&
      body != null &&
      typeof body.type !== 'undefined' &&
      body.type != null &&
      body.type === 'url_verification'
    ) {
      // url_verification will be handled by the synchronous receiver instead of this one.
      return true;
    }

    let isAcknowledged = false;
    // This is typically added to the synchronous receiver in order to avoid Slack timeouts.
    // Since the synchronous receiver should automatically ack we are leaving it there and letting
    // the asynchronous receiver just take the time it needs.
    // const noAckTimeoutId = setTimeout(() => {
    //   if (!isAcknowledged) {
    //     this.logger.error(
    //       'An incoming event was not acknowledged within 3 seconds. ' +
    //         'Ensure that the ack() argument is called in a listener.',
    //     );
    //   }
    // }, 3001);

    // Structure the ReceiverEvent
    let storedResponse: string | undefined | Record<string, unknown>;
    const event: ReceiverEvent = {
      body,
      ack: async (response) => {
        if (isAcknowledged) {
          throw new ReceiverMultipleAckError();
        }
        isAcknowledged = true;
        // clearTimeout(noAckTimeoutId);
        if (typeof response === 'undefined' || response == null) {
          storedResponse = '';
        } else {
          this.logger.warn({
            msg: `received ack with body`,
            ackResponse: response,
          });
          throw new AckWithBodyError(
            'ack received body in asynchronous receiver',
          );
        }
      },
      retryNum: this.getHeaderValue(sqsEvent.headers, 'X-Slack-Retry-Num') as
        | number
        | undefined,
      retryReason: this.getHeaderValue(
        sqsEvent.headers,
        'X-Slack-Retry-Reason',
      ),
    };

    // Send the event to the app for processing
    try {
      await this.app?.processEvent(event);
      if (storedResponse !== undefined) {
        if (storedResponse === '') {
          return true;
        }

        this.logger.warn({
          msg: `received ack with body`,
          ackResponse: storedResponse,
        });
        throw new AckWithBodyError(
          'ack received body in asynchronous receiver',
        );
      }
    } catch (err) {
      this.logger.error(
        'An unhandled error occurred while Bolt processed an event',
      );
      this.logger.debug(
        `Error details: ${err}, storedResponse: ${storedResponse}`,
      );
      return false;
    }

    this.logger.info({
      msg: `No request handler matched the event`,
      event: event,
    });
    return true; // true because we want to ack since it's invalid, no use retrying
  }

  private validateSqsEvent(raw: Record<string, unknown>): raw is SQSEvent {
    // Is an SQSEvent if we have a string body and a Record<string, string> for headers (optional)
    return (
      typeof (raw as SQSEvent).body === 'string' &&
      (typeof (raw as SQSEvent).headers === 'undefined' ||
        typeof (raw as SQSEvent).headers === 'object')
    );
  }

  private getRawBody(sqsEvent: SQSEvent): string {
    if (
      typeof sqsEvent.body === 'undefined' ||
      sqsEvent.body == null ||
      typeof sqsEvent.body !== 'string'
    ) {
      return '';
    }
    if (sqsEvent.isBase64Encoded) {
      return Buffer.from(sqsEvent.body, 'base64').toString('ascii');
    }

    return sqsEvent.body;
  }

  private parseRequestBody(
    stringBody: string,
    contentType: string | undefined,
    logger: Logger,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    if (contentType === 'application/x-www-form-urlencoded') {
      // querystring is deprecated, and yet the bolt framework still uses it.
      // We should migrate it to the URLSearchParams api soon.
      const parsedBody = querystring.parse(stringBody);
      if (typeof parsedBody.payload === 'string') {
        return JSON.parse(parsedBody.payload);
      }
      return parsedBody;
    }
    if (contentType === 'application/json') {
      return JSON.parse(stringBody);
    }

    logger.warn(`Unexpected content-type detected: ${contentType}`);
    try {
      // Parse this body anyway
      return JSON.parse(stringBody);
    } catch (e) {
      logger.error(
        `Failed to parse body as JSON data for content-type: ${contentType}`,
      );
      throw e;
    }
  }

  private getHeaderValue(
    headers: Record<string, string> | undefined,
    key: string,
  ): string | undefined {
    if (!headers) {
      return;
    }

    const caseInsensitiveKey = Object.keys(headers).find(
      (it) => key.toLowerCase() === it.toLowerCase(),
    );
    return caseInsensitiveKey !== undefined
      ? headers[caseInsensitiveKey]
      : undefined;
  }
}
