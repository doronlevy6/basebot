import { SlackEventWrapper } from '../slack/types';
import { OnboardingManager } from './manager';

export const appHomeOpenedHandler =
  (onboardingManager: OnboardingManager) =>
  async ({
    client,
    logger,
    event,
    body,
    context,
  }: SlackEventWrapper<'app_home_opened'>) => {
    const { team_id } = body;
    const { user } = event;

    try {
      logger.info(`user ${user} opened the bot DMs`);
      await onboardingManager.onboardUser(
        team_id,
        user,
        client,
        'app_home_opened',
        context.botUserId,
      );
    } catch (err) {
      logger.error(`App home opened onboarding error: ${err} ${err.stack}`);
    }
  };
