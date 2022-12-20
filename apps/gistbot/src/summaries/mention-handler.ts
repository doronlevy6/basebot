import { GenericMessageEvent } from '@slack/bolt';
import { AnalyticsManager } from '@base/gistbot-shared';
import { OnboardingManager } from '../onboarding/manager';
import { SlackEventWrapper } from '../slack/types';
import { IReporter } from '@base/metrics';
import { ChatManager } from '../experimental/chat/manager';

export const mentionHandler =
  (
    analyticsManager: AnalyticsManager,
    metricsReporter: IReporter,
    onboardingManager: OnboardingManager,
    chatManager: ChatManager,
  ) =>
  async ({ client, logger, body, context }: SlackEventWrapper<'message'>) => {
    try {
      const { team_id } = body;
      const event = body.event as GenericMessageEvent;
      const { channel, user } = event;
      logger.info(`${event.user} mentioned us in ${event.channel}`);

      if (event.channel_type === 'im') {
        // Exclude mention in the bot dm.
        return;
      }

      const chatPromise = chatManager.handleChatMessage({
        channelId: channel,
        userId: user,
        teamId: team_id,
        client,
        logger,
      });

      const onboardingPromise = onboardingManager.onboardUser(
        team_id,
        event.user,
        client,
        'direct_mention',
        context.botUserId,
      );

      await Promise.all([chatPromise, onboardingPromise]);

      analyticsManager.botMentioned({
        slackTeamId: team_id,
        slackUserId: event.user,
        channelId: event.channel,
        properties: {
          mention_message_text: event.text || '',
        },
      });
    } catch (error) {
      metricsReporter.error('mention summarization', 'mention-summarization');
      logger.error(
        `error in handling mention summarization: ${error} ${error.stack}`,
      );
    }
  };
