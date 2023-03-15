import { Endpoint, EventBridge } from 'aws-sdk';
import { logger } from '@base/logger';
import { Publisher } from '../types';
import { EventBridgeConfig } from './types';

export class EventBridgePublisher implements Publisher {
  private client: EventBridge;

  constructor(private cfg: EventBridgeConfig) {
    this.client = new EventBridge({
      region: cfg.region,
      endpoint: new Endpoint(cfg.baseUrl),
    });
  }

  async publish(queue: string, event: Record<string, unknown>): Promise<void> {
    logger.debug({ message: `Sending event to eventbridge bus ${queue}` });

    // EventBridge will output an event to our event sink that looks like this:
    /*
      {
        "version": "0",
        "id": "ddb92292-8a52-6288-77c6-03272124f350",
        "detail-type": "local-messages",
        "source": "slacker",
        "account": "xxxxxxxxx",
        "time": "2023-03-12T12:50:13Z",
        "region": "us-east-1",
        "resources": [],
        "detail": {...}
      }
    */

    try {
      const data = await new Promise<EventBridge.PutEventsResponse>(
        (resolve, reject) => {
          this.client.putEvents(
            {
              Entries: [
                {
                  Time: new Date(),
                  Source: this.cfg.serviceName,
                  DetailType: queue,
                  Detail: JSON.stringify(event),
                  EventBusName: this.cfg.bridge,
                },
              ],
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
      logger.debug({ msg: 'published message to event bridge', data: data });
    } catch (error) {
      logger.error({
        msg: `error in publishing message to event bridge`,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }
}
