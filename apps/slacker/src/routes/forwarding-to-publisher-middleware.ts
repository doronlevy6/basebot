import { Publisher } from '@base/pubsub';
import { AckFn, AnyMiddlewareArgs, Middleware } from '@slack/bolt';
import {
  isActionArgs,
  isCommandArgs,
  isViewArgs,
  isShortcutArgs,
  isEventArgs,
  isOptionsArgs,
} from './middleware-utils';

interface acker {
  ack: AckFn<unknown>;
}

export const forwardingToPublisherMiddleware =
  (queueName: string, publisher: Publisher): Middleware<AnyMiddlewareArgs> =>
  async (args) => {
    const { logger, body } = args;
    const acker = getAcker(args);

    // First publish the event to the queue, then ack it afterwards
    try {
      await publisher.publish(queueName, {
        body: JSON.stringify(body),
        headers: {
          'content-type': 'application/json',
          'X-Slack-Retry-Num': args.context.retryNum,
          'X-Slack-Retry-Reason': args.context.retryReason,
        },
      });
    } catch (error) {
      logger.error({
        msg: `error publishing event to queue`,
        event: body,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }

    try {
      await acker.ack();
    } catch (error) {
      logger.error({
        msg: `error acking event`,
        event: body,
        error: error.message,
        stack: error.stack,
      });
    }

    // If we've reached here, it means we've successfully sent the event to the queue
    // and acked the event. There's no need to call next() since we shouldn't have anything here
    // that requires a next function.
    return;
  };

function getAcker(args: AnyMiddlewareArgs): acker {
  if (isActionArgs(args)) {
    return {
      ack: args.ack,
    };
  }

  if (isCommandArgs(args)) {
    return {
      ack: args.ack,
    };
  }

  if (isViewArgs(args)) {
    return {
      ack: args.ack,
    };
  }

  if (isShortcutArgs(args)) {
    return {
      ack: args.ack,
    };
  }

  if (isOptionsArgs(args)) {
    return {
      ack: args.ack,
    };
  }

  if (isEventArgs(args)) {
    return {
      ack: async () => {
        // Empty ack stub for anything that's an event that doesn't have an ack function
        return;
      },
    };
  }

  // All of the various Slack event types should be handled at this point, making the type of `args` a `never`.
  // This validates that the type is a `never` and ensures that if more types are added that need to be handled we force
  // a compilation error in order to ensure that we handle all of Slack's possible event types.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mustBeNever = (_x: never) => {
    throw new Error('unreachable');
  };
  mustBeNever(args);

  // This is unreachable. If `args` is not `never` here, then the `mustBeNever` function should cause a compilation error.
  // Since `args` is never, it can never reach this code.
  // We add this error to allow the type of this function to return just `acker` instead of `acker | undefined`.
  throw new Error('unreachable');
}
