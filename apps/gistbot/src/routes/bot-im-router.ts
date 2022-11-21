import {
  CustomerIdentifier,
  isPassphraseMessage,
} from '@base/customer-identifier';
import { AnalyticsManager } from '@base/gistbot-shared';
import { OnboardingManager } from '../onboarding/manager';
import { Help } from '../slack/components/help';
import { SlackEventWrapper } from '../slack/types';
import { isBaseTeamWorkspace } from '../slack/utils';

export const botIMRouter = (
  analyticsManager: AnalyticsManager,
  onboardingManager: OnboardingManager,
  customerIdentifier: CustomerIdentifier,
) => {
  return async ({
    event,
    say,
    body,
    context,
    logger,
    client,
  }: SlackEventWrapper<'message'>) => {
    if (event.channel_type !== 'im') {
      // Just a normal message. This will be caught by other handlers and doesn't need to be handled here.
      return;
    }

    if ('bot_profile' in event) {
      logger.warn({ msg: `a bot is talking to us`, bot: event.bot_profile });
      return;
    }

    logger.debug({ msg: `im to the bot`, event: event });

    // The Slackbot user will send messages to us at various times.
    // To avoid sending a message back and generating a firestorm of messages,
    // we ignore all messages sent by the Slackbot user.
    if ('user' in event && event.user === 'USLACKBOT') {
      return;
    }

    if (!('user' in event) || !event.user) {
      logger.warn({ msg: `im without user`, event: event });
      return;
    }

    const isPassphrase = isPassphraseMessage(event.text || '');
    if (event.text && isPassphrase) {
      if (isPassphrase === 'too_short') {
        // TODO: handle this situation where it's a passphrase message but it doesn't match the correct length
        logger.error({
          msg: `user sent us a passphrase that is too short`,
          event: event,
        });
        return;
      }

      try {
        const result = await customerIdentifier.matchUserToCustomer(
          event.text,
          event.user,
          body.team_id,
        );

        if (result === 'no_match') {
          logger.error({
            msg: `user sent us a passphrase that doesn't match a customer`,
            event: event,
          });
          await say(
            'I tried activating your subscription, ' +
              'but I was unable to find your customer account :frowning: ' +
              'are you sure you copied it correctly?\n\n' +
              'If you have more trouble with this, feel free to contact our support at support@thegist.ai',
          );
          return;
        }

        if (result === 'team_mismatch' || result === 'user_mismatch') {
          logger.error({
            msg: `user sent us a passphrase that matches an already subscribed customer`,
            event: event,
          });
          await say(
            // Send the same "not found text" to avoid some brute force security shit?
            'I tried activating your subscription, ' +
              'but I was unable to find your customer account :frowning: ' +
              'are you sure you copied it correctly?\n\n' +
              'If you have more trouble with this, feel free to contact our support at support@thegist.ai',
          );
          return;
        }

        await say(
          'Great! I have connected your customer account and have activated your subscription!\n\n' +
            'Happy Gist-ing :smile:!',
        );
      } catch (error) {
        logger.error({
          msg: `error in matching user to customer`,
          error: error.message,
          stack: error.stack,
        });
      }

      //TODO: Possibly onboard user? If the user had not been onboarded maybe...
      // We can leave that up to the product decision.
      return;
    }

    // If the user hasn't been onboarded yet then we only want to trigger the onboarding
    const wasOnboarded = await onboardingManager.wasUserOnboarded(
      body.team_id,
      event.user,
    );
    if (!wasOnboarded) {
      await onboardingManager.onboardUser(
        body.team_id,
        event.user,
        client,
        'app_home_opened',
      );
      return;
    }

    // On our internal workspace we avoid sending the help message in order to allow us to test the onboarding.
    // This is only for internal use and is ignored externally.
    if (isBaseTeamWorkspace(body.team_id)) {
      return;
    }

    await say({
      text: 'Hi there :wave:',
      blocks: Help(event.user, context.botUserId || ''),
    });

    analyticsManager.messageSentToUserDM({
      type: 'help_response_message',
      slackTeamId: body.team_id,
      slackUserId: event['user'],
      properties: {
        triggerMessage: event['text'] || 'unknown text',
      },
    });
  };
};
