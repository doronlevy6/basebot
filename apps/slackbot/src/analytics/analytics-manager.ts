import { logger } from '@base/logger';
import { createQueue, IQueueConfig, QueueWrapper } from '@base/queues';
import { EventSource, IAnalyticsEvent } from '@base/oapigen';

type ExtraParams = Record<string, string | boolean | number>;

class Analytics {
  private queueCfg: IQueueConfig;
  private analyticsQueue: QueueWrapper;

  constructor(queueCfg: IQueueConfig) {
    this.queueCfg = queueCfg;
  }

  async startQueue() {
    this.analyticsQueue = createQueue('analytics', this.queueCfg);
  }

  async close() {
    await this.analyticsQueue.queue.close();
    await this.analyticsQueue.scheduler.close();
  }

  private async sendEventToBase(data: IAnalyticsEvent) {
    logger.info({ msg: 'send event to base', job: data });
    data.eventSource = EventSource.Slackbot;
    await this.analyticsQueue.queue.add('slack_events', data);
  }

  messageSentToUser(email: string, extraParams?: ExtraParams) {
    this.sendEventToBase({
      name: 'message_sent_to_user',
      properties: { ...extraParams, email },
    });
  }

  userInteraction(email: string, extraParams?: ExtraParams) {
    this.sendEventToBase({
      name: 'user_interacted',
      properties: { ...extraParams, email },
    });
  }

  userCreateDraft(email: string, extraParams?: ExtraParams) {
    this.sendEventToBase({
      name: 'user_create_draft',
      properties: { ...extraParams, email },
    });
  }
}

export const AnalyticsManager = (function () {
  let instance: Analytics;
  return {
    initialize(queueCfg: IQueueConfig) {
      instance = new Analytics(queueCfg);
      instance.startQueue();
      instance.constructor = () => {
        return;
      };
    },
    getInstance: function (): Analytics {
      if (instance == null) {
        throw new Error('AnalyticsManager was not initialized');
      }
      return instance;
    },
    close: async function () {
      if (instance == null) {
        return;
      }
      return instance.close();
    },
  };
})();
