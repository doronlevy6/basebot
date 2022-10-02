import { logger } from '@base/logger';
import Segment = require('analytics-node');

type ExtraParams = Record<string, string | boolean | number>;

interface Event {
  eventName: string;
  slackUserId: string;
  slackTeamId: string;
  internalUserId: string;
  timestamp: Date;
  properties: Record<string, string | boolean | number>;
}

export class AnalyticsManager {
  private client: Segment;

  constructor() {
    const key = process.env.SEGMENT_KEY as string;
    this.client = new Segment(key, { enable: Boolean(key) });
  }

  async isReady(): Promise<boolean> {
    return true;
  }

  async close() {
    try {
      await this.client.flush();
    } catch (error) {
      logger.error(`failed to flush analytics batch on close: ${error.stack}`);
    }
  }

  private sendEventToAnalytics(data: Event) {
    logger.info({ msg: 'send event to analytics', job: data });
    this.client.track({
      event: data.eventName,
      userId: data.internalUserId,
      timestamp: data.timestamp,
      properties: {
        ...data.properties,
        slackUserId: data.slackUserId,
        slackTeamId: data.slackTeamId,
        service: 'gistbot',
      },
    });
  }

  modalView({
    type,
    slackUserId,
    slackTeamId,
    properties,
  }: {
    type: string;
    slackUserId: string;
    slackTeamId: string;
    properties?: ExtraParams;
  }) {
    this.sendEventToAnalytics({
      eventName: 'slack_modal_view',
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
      internalUserId: `${slackTeamId}_${slackUserId}`,
      timestamp: new Date(),
      properties: { ...properties, type },
    });
  }

  modalClosed({
    type,
    slackUserId,
    slackTeamId,
    submitted,
    properties,
  }: {
    type: string;
    slackUserId: string;
    slackTeamId: string;
    submitted: boolean;
    properties?: ExtraParams;
  }) {
    this.sendEventToAnalytics({
      eventName: 'slack_modal_close',
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
      internalUserId: `${slackTeamId}_${slackUserId}`,
      timestamp: new Date(),
      properties: { ...properties, type, submitted },
    });
  }

  error({
    slackUserId,
    slackTeamId,
    channelId,
    errorMessage,
    extraParams,
  }: {
    slackUserId: string;
    slackTeamId: string;
    channelId: string;
    errorMessage: string;
    extraParams?: ExtraParams;
  }) {
    this.sendEventToAnalytics({
      eventName: `errors`,
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
      internalUserId: `${slackTeamId}_${slackUserId}`,
      timestamp: new Date(),
      properties: { ...extraParams, channelId, errorMessage },
    });
  }

  installationFunnel({
    funnelStep,
    slackUserId,
    slackTeamId,
    extraParams,
  }: {
    funnelStep: string;
    slackUserId: string;
    slackTeamId: string;
    extraParams?: ExtraParams;
  }) {
    this.sendEventToAnalytics({
      eventName: `installation_${funnelStep}`,
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
      internalUserId: `${slackTeamId}_${slackUserId}`,
      timestamp: new Date(),
      properties: { ...extraParams },
    });
  }

  threadSummaryFunnel({
    funnelStep,
    slackUserId,
    slackTeamId,
    channelId,
    threadTs,
    extraParams,
  }: {
    funnelStep: string;
    slackUserId: string;
    slackTeamId: string;
    channelId: string;
    threadTs: string;
    extraParams?: ExtraParams;
  }) {
    this.sendEventToAnalytics({
      eventName: `thread_summary_${funnelStep}`,
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
      internalUserId: `${slackTeamId}_${slackUserId}`,
      timestamp: new Date(),
      properties: { ...extraParams, channelId, threadTs },
    });
  }

  channelSummaryFunnel({
    funnelStep,
    slackUserId,
    slackTeamId,
    channelId,
    extraParams,
  }: {
    funnelStep: string;
    slackUserId: string;
    slackTeamId: string;
    channelId: string;
    extraParams?: ExtraParams;
  }) {
    this.sendEventToAnalytics({
      eventName: `channel_summary_${funnelStep}`,
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
      internalUserId: `${slackTeamId}_${slackUserId}`,
      timestamp: new Date(),
      properties: { ...extraParams, channelId },
    });
  }

  addedToChannel({
    slackUserId,
    slackTeamId,
    channelId,
    extraParams,
  }: {
    slackUserId: string;
    slackTeamId: string;
    channelId: string;
    extraParams?: ExtraParams;
  }) {
    this.sendEventToAnalytics({
      eventName: `added_to_channel`,
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
      internalUserId: `${slackTeamId}_${slackUserId}`,
      timestamp: new Date(),
      properties: { ...extraParams, channelId },
    });
  }
}
