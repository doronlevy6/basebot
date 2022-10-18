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

interface UserIdentification {
  slackUserId: string;
  slackTeamId: string;
  username?: string;
  realName?: string;
  title?: string;
  avatarUrl?: string;
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

  private internalId(slackTeamId: string, slackUserId: string): string {
    return `${slackTeamId}_${slackUserId}`;
  }

  identifyUser(user: UserIdentification) {
    logger.info({ msg: 'identifying user in analytics', user: user });
    this.client.identify({
      userId: this.internalId(user.slackTeamId, user.slackUserId),
      traits: {
        name: user.realName,
        username: user.username,
        title: user.title,
        slackTeamId: user.slackTeamId,
        service: 'gistbot',
      },
    });
  }

  botMentioned({
    slackUserId,
    slackTeamId,
    channelId,
    properties,
  }: {
    slackUserId: string;
    slackTeamId: string;
    channelId: string;
    properties?: ExtraParams;
  }) {
    this.sendEventToAnalytics({
      eventName: 'bot_mentioned',
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
      internalUserId: this.internalId(slackTeamId, slackUserId),
      timestamp: new Date(),
      properties: { ...properties, channelId },
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
      internalUserId: this.internalId(slackTeamId, slackUserId),
      timestamp: new Date(),
      properties: { ...properties, type },
    });
  }

  welcomeMessageInteraction({
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
      eventName: 'slack_welcome_message',
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
      internalUserId: this.internalId(slackTeamId, slackUserId),
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
      internalUserId: this.internalId(slackTeamId, slackUserId),
      timestamp: new Date(),
      properties: { ...properties, type, submitted },
    });
  }

  messageSentToUserDM({
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
      eventName: 'slack_direct_message_sent',
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
      internalUserId: this.internalId(slackTeamId, slackUserId),
      timestamp: new Date(),
      properties: { ...properties, type },
    });
  }
  emailSentToUserDM({
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
      eventName: 'email_sent',
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
      internalUserId: this.internalId(slackTeamId, slackUserId),
      timestamp: new Date(),
      properties: { ...properties, type },
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
      internalUserId: this.internalId(slackTeamId, slackUserId),
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
      internalUserId: this.internalId(slackTeamId, slackUserId),
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
      internalUserId: this.internalId(slackTeamId, slackUserId),
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
      internalUserId: this.internalId(slackTeamId, slackUserId),
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
      internalUserId: this.internalId(slackTeamId, slackUserId),
      timestamp: new Date(),
      properties: { ...extraParams, channelId },
    });
  }
}
