import { logger } from '@base/logger';
import Segment = require('analytics-node');

type ExtraParams = Record<string, string | boolean | number | string[]>;

interface Event {
  eventName: string;
  slackUserId: string;
  slackTeamId: string;
  internalUserId: string;
  timestamp: Date;
  properties: Record<string, string | boolean | number | string[]>;
}

interface UserIdentification {
  slackUserId: string;
  slackTeamId: string;
  username?: string;
  realName?: string;
  title?: string;
  avatarUrl?: string;
  email?: string;
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
      logger.error(
        `failed to flush analytics batch on close: ${(error as Error).stack}`,
      );
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
    logger.info({ msg: 'identifying user in analytics', user });
    const { realName, username, title, slackTeamId, email, avatarUrl } = user;
    this.client.identify({
      userId: this.internalId(user.slackTeamId, user.slackUserId),
      traits: {
        name: realName,
        username,
        title: title,
        slackTeamId: slackTeamId,
        email,
        service: 'gistbot',
        avatar: avatarUrl,
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

  scheduledMultichannelSummaryFunnel({
    slackUserId,
    slackTeamId,
    channedIds,
    scheduledTime,
    extraParams,
  }: {
    slackUserId: string;
    slackTeamId: string;
    channedIds: string[];
    scheduledTime: string;
    extraParams?: ExtraParams;
  }) {
    this.sendEventToAnalytics({
      eventName: `scheduled_multi_channel_summary`,
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
      internalUserId: this.internalId(slackTeamId, slackUserId),
      timestamp: new Date(),
      properties: { ...extraParams, channedIds, scheduledTime },
    });
  }

  scheduleSettingsSaved({
    slackUserId,
    slackTeamId,
    channelIds,
    scheduledTime,
    extraParams,
  }: {
    slackUserId: string;
    slackTeamId: string;
    channelIds: string[];
    scheduledTime: string;
    extraParams?: ExtraParams;
  }) {
    this.sendEventToAnalytics({
      eventName: `scheduled_settings_saved`,
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
      internalUserId: this.internalId(slackTeamId, slackUserId),
      timestamp: new Date(),
      properties: { ...extraParams, channelIds, scheduledTime },
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

  stopNudge({
    slackUserId,
    slackTeamId,
  }: {
    slackUserId: string;
    slackTeamId: string;
  }) {
    this.sendEventToAnalytics({
      eventName: `stop_nudge_requested`,
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
      internalUserId: this.internalId(slackTeamId, slackUserId),
      timestamp: new Date(),
      properties: {},
    });
  }

  buttonClicked({
    type,
    slackUserId,
    slackTeamId,
    extraParams,
  }: {
    type: string;
    slackUserId: string;
    slackTeamId: string;
    extraParams?: ExtraParams;
  }) {
    this.sendEventToAnalytics({
      eventName: `button_clicked`,
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
      internalUserId: this.internalId(slackTeamId, slackUserId),
      timestamp: new Date(),
      properties: { ...extraParams, type: type },
    });
  }
  triggerFeedback({
    type,
    slackUserId,
    slackTeamId,
    extraParams,
  }: {
    type: string;
    slackUserId: string;
    slackTeamId: string;
    extraParams?: ExtraParams;
  }) {
    this.sendEventToAnalytics({
      eventName: `trigger_feedback_submitted`,
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
      internalUserId: this.internalId(slackTeamId, slackUserId),
      timestamp: new Date(),
      properties: { ...extraParams, type: type },
    });
  }

  appHomeOpened({
    slackUserId,
    slackTeamId,
    extraParams,
  }: {
    slackUserId: string;
    slackTeamId: string;
    extraParams?: ExtraParams;
  }) {
    this.sendEventToAnalytics({
      eventName: `app_home_opened`,
      slackUserId: slackUserId,
      slackTeamId: slackTeamId,
      internalUserId: this.internalId(slackTeamId, slackUserId),
      timestamp: new Date(),
      properties: { ...extraParams },
    });
  }
}
