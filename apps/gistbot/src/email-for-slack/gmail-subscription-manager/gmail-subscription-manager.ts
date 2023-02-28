import {
  SubscriptionManager,
  SubscriptionTier,
} from '@base/customer-identifier';
import { FeatureLimits } from '../../feature-rate-limiter/limits';
import { HomeDataStore } from '../../home/home-data-store';
import { EmailGoProView } from '../views/email-go-pro-view';
import { SlackBlockActionWrapper } from '../../slack/types';
import { AnalyticsManager } from '@base/gistbot-shared';

type SubscriptionManagerActionParams = Pick<
  SlackBlockActionWrapper,
  'client' | 'logger' | 'body'
>;

export class GmailSubscriptionsManager {
  constructor(
    private subscriptionManager: SubscriptionManager,
    private homeDataStore: HomeDataStore,
    private analyticsManager: AnalyticsManager,
  ) {}

  getDaysLeftForUser = async (
    slackUserId: string,
    slackTeamId: string,
    trialDaysAmount: number,
  ) => {
    const userHomeData = await this.homeDataStore.fetch({
      slackUserId,
      slackTeamId,
    });
    const connectionDate = userHomeData?.gmailConnected;
    if (!connectionDate) {
      return undefined;
    }
    const expiryDate = connectionDate.setDate(
      connectionDate.getDate() + trialDaysAmount,
    );
    return Math.ceil(
      (expiryDate - new Date().getTime()) / (1000 * 60 * 60 * 24),
    );
  };

  emailAllowedAction = async (slackUserId: string, slackTeamId: string) => {
    const tier = await this.subscriptionManager.userTier(
      slackTeamId,
      slackUserId,
    );
    if (tier === SubscriptionTier.FREE) {
      const daysLeft = await this.getDaysLeftForUser(
        slackUserId,
        slackTeamId,
        FeatureLimits.GMAIL.FREE as number,
      );
      return !!daysLeft && daysLeft >= 0;
    }
    return true;
  };

  freeTrialDaysLeft = async (
    slackUserId: string,
    slackTeamId: string,
  ): Promise<undefined | number> => {
    const tier = await this.subscriptionManager.userTier(
      slackTeamId,
      slackUserId,
    );
    if (tier === SubscriptionTier.FREE) {
      return this.getDaysLeftForUser(
        slackUserId,
        slackTeamId,
        FeatureLimits.GMAIL.FREE as number,
      );
    }
    return undefined;
  };

  showPaywallIfNeeded = async (
    slackUserId: string,
    slackTeamId: string,
    action: string,
    { logger, body, client }: SubscriptionManagerActionParams,
  ): Promise<boolean> => {
    try {
      const allowedAction = await this.emailAllowedAction(
        slackUserId,
        slackTeamId,
      );
      if (!allowedAction) {
        logger.info(
          `user ${body.user.id} reached paywall for gmail, ${action} action`,
        );
        this.analyticsManager.gmailUserActionBlockedByPaywall({
          slackUserId: body.user.id,
          slackTeamId: body.team?.id || '',
          action: action,
        });
        await client.views.open({
          trigger_id: body.trigger_id,
          view: EmailGoProView(),
        });
      }
      return allowedAction;
    } catch (error) {
      logger.error(
        `error occured while trying to process tier for gmail, ${error}`,
      );
      throw error;
    }
  };
}
