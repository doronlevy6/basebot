import { GenericMessageEvent, KnownBlock } from '@slack/bolt';
import { ChatPostEphemeralResponse, WebClient } from '@slack/web-api';
import { AnalyticsManager } from '@base/gistbot-shared';
import { NewUserTriggersManager } from '../new-user-triggers/manager';
import { OnboardingManager } from '../onboarding/manager';
import { Routes } from '../routes/router';
import { UserLink } from '../slack/components/user-link';
import { getThreadMentionedUsersFromContext } from '../slack/mentioned-in-thread.middleware';
import { SlackBlockActionWrapper, SlackEventWrapper } from '../slack/types';
import { ThreadSummarizer } from './thread/thread-summarizer';
import { summaryInProgressMessage } from './utils';
import { TriggerContext } from './types';
import { IReporter } from '@base/metrics';
import { TriggersFeedBack } from '../slack/components/trigger-feedback';
import { getOrgSettingsFromContext } from '../orgsettings/middleware';
import { SchedulerSettingsManager } from '../summary-scheduler/scheduler-manager';

const THREAD_LENGTH_LIMIT = 6;

interface MentionedInThreadProps {
  threadTs: string;
  channelId: string;
  triggerContext: TriggerContext;
  threadPermalink: string;
}

export const mentionedInThreadHandler =
  (
    analyticsManager: AnalyticsManager,
    metricsReporter: IReporter,
    newUserTriggersManager: NewUserTriggersManager,
  ) =>
  async ({ client, logger, body, context }: SlackEventWrapper<'message'>) => {
    try {
      const event = body.event as GenericMessageEvent;

      if (!event.thread_ts) {
        logger.warn(`received no thread_ts in mentioned in thread handler`);
        return;
      }

      const threadMentionedUsers = new Set(
        getThreadMentionedUsersFromContext(context),
      );
      if (threadMentionedUsers.size === 0) {
        logger.warn(
          `received no thread mentioned users in mentioned in thread handler`,
        );
        return;
      }

      // If the org settings are undefined (not able to be found on the event for some reason)
      // or the triggers are not enabled, we drop the event.
      const orgSettings = getOrgSettingsFromContext(context);
      if (!orgSettings || !orgSettings.newUserTriggersEnabled) {
        logger.info({
          msg: 'triggers are disabled on the organization, skipping mentioned in thread event',
          event: body,
          orgSettings: orgSettings,
        });
        return;
      }

      const {
        error: repliesError,
        ok: repliesOk,
        messages,
      } = await client.conversations.replies({
        ts: event.thread_ts,
        channel: event.channel,
        latest: event.ts,
        limit: THREAD_LENGTH_LIMIT,
      });

      if (repliesError || !repliesOk) {
        throw new Error(`Failed to fetch conversation replies ${repliesError}`);
      }

      if (!messages) {
        throw new Error(`Failed to fetch replies not found`);
      }

      if (messages.length < THREAD_LENGTH_LIMIT) {
        logger.info(
          `thread ${event.thread_ts} has less than ${THREAD_LENGTH_LIMIT} messages`,
        );
        return;
      }

      messages.forEach((m) => {
        if (m.user && threadMentionedUsers.has(m.user)) {
          threadMentionedUsers.delete(m.user);
        }
      });

      if (threadMentionedUsers.size === 0) {
        logger.info(
          `all mentioned users were active within the last ${THREAD_LENGTH_LIMIT} messages on ${event.thread_ts}`,
        );
        return;
      }

      const {
        error: linkError,
        ok: linkOk,
        permalink,
      } = await client.chat.getPermalink({
        channel: event.channel,
        message_ts: event.thread_ts,
      });

      if (linkError || !linkOk) {
        throw new Error(`Failed to get permalink to message ${linkError}`);
      }

      if (!permalink) {
        throw new Error(`Failed to get permalink to message not found`);
      }

      const awaits: Promise<ChatPostEphemeralResponse | null>[] = [];
      for (const user of threadMentionedUsers) {
        awaits.push(
          sendUserSuggestion(
            event.thread_ts,
            event.channel,
            user,
            context.botUserId || '',
            body.team_id,
            permalink,
            analyticsManager,
            client,
            newUserTriggersManager,
          ),
        );
      }

      await Promise.all(awaits);
    } catch (error) {
      metricsReporter.error(
        'mentioned in thread',
        'mentioned-in-thread-handler',
      );
      logger.error(
        `error in handling thread mentioned users: ${error} ${error.stack}`,
      );
    }
  };

export const summarizeSuggestedThreadAfterMention =
  (
    analyticsManager: AnalyticsManager,
    metricsReporter: IReporter,
    threadSummarizer: ThreadSummarizer,
    onboardingManager: OnboardingManager,
    schedulerManager: SchedulerSettingsManager,
  ) =>
  async ({ ack, logger, body, client, context }: SlackBlockActionWrapper) => {
    try {
      await ack();

      const action = body.actions[0];
      if (action.type !== 'button') {
        throw new Error(
          'summarize thread after mention received non-button action',
        );
      }

      const props = JSON.parse(action.value) as MentionedInThreadProps;

      await summaryInProgressMessage(client, {
        channel: props.channelId,
        user: body.user.id,
        thread_ts: props.threadTs,
        trigger_context: props.triggerContext,
      });

      const { error, ok, channel } = await client.conversations.info({
        channel: props.channelId,
      });

      if (error || !ok) {
        throw new Error(`Failed to fetch conversation info ${error}`);
      }

      if (!channel || !channel.name) {
        throw new Error(
          `Failed to fetch conversation info conversation not found`,
        );
      }

      await threadSummarizer.summarize(
        context.botId || '',
        body.team?.id || 'unknown',
        body.user.id,
        {
          type: 'thread',
          channelId: props.channelId,
          channelName: channel.name,
          threadTs: props.threadTs,
        },
        client,
      );

      if (props.triggerContext === 'in_dm') {
        await client.chat.postMessage({
          channel: body.user.id,
          text: `Great, your summary was created! Go and see your summary <${props.threadPermalink}|here>`,
        });
      }

      // Trigger the onboarding at the end so that after they've clicked on the message the onboarding message will happen
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait for 10 seconds before triggering the onboarding message so we don't surprise the user before they see the previous message
      await onboardingManager.onboardUser(
        body.team?.id || 'unknown',
        body.user.id,
        client,
        'suggested_thread_summary',
      );
      schedulerManager
        .saveDefaultUserSchedulerSettings(
          client,
          body.user.id,
          body.team?.id || 'unknown',
          [props.channelId],
        )
        .catch((e) => {
          logger.error(
            `error in saving default user settings in thread mention, ${e}`,
          );
        });
    } catch (error) {
      metricsReporter.error(
        'summarize thread after mention',
        'summarize-thread-after-mention',
      );
      logger.error(
        `error in summarize suggested thread after mention: ${error} ${error.stack}`,
      );
    }
  };

const sendUserSuggestion = async (
  threadTs: string,
  channelId: string,
  userId: string,
  botUserId: string,
  teamId: string,
  threadPermalink: string,
  analyticsManager: AnalyticsManager,
  client: WebClient,
  newUserTriggersManager: NewUserTriggersManager,
): Promise<ChatPostEphemeralResponse | null> => {
  const {
    error: presenceErr,
    ok: presenceOk,
    presence,
  } = await client.users.getPresence({ user: userId });
  if (presenceErr || !presenceOk) {
    throw new Error(`Failed to get presence ${presenceErr}`);
  }

  if (!presence) {
    throw new Error(`Failed to get presence not found`);
  }

  const props: MentionedInThreadProps = {
    threadTs: threadTs,
    channelId: channelId,
    triggerContext: presence === 'away' ? 'in_dm' : 'in_channel',
    threadPermalink: threadPermalink,
  };

  const shouldTrigger =
    await newUserTriggersManager.shouldTriggerForPotentialUser(
      'thread_mention',
      teamId,
      userId,
      presence,
    );

  if (!shouldTrigger) {
    return null;
  }

  let basicText: string;
  if (presence === 'away') {
    basicText = `Hi ${UserLink(userId)} I'm ${UserLink(
      botUserId,
    )}, I make life simpler by summarizing discussions on Slack.\n\nYou were mentioned in <${threadPermalink}|this long thread> that you haven't been active in yet.\n\nWould you like a summary of the discussion so far?`;
  } else {
    basicText = `Hi ${UserLink(userId)} I'm ${UserLink(
      botUserId,
    )}, I make life simpler by summarizing discussions on Slack.\n\nYou were mentioned in this long thread that you haven't been active in yet.\n\nWould you like a summary of the discussion so far?`;
  }

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: basicText,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Summarize this thread',
            emoji: true,
          },
          style: 'primary',
          value: JSON.stringify(props),
          action_id: Routes.SUMMARIZE_THREAD_FROM_THREAD_MENTION,
        },
      ],
    },
  ];
  blocks.push(...TriggersFeedBack('thread_mention'));

  analyticsManager.messageSentToUserDM({
    type: 'suggest_thread_summary_for_thread',
    slackUserId: userId,
    slackTeamId: teamId,
    properties: {
      suggestedThread: threadTs,
      suggestedChannel: channelId,
      ephemeralInChannel: presence !== 'away',
    },
  });

  if (presence === 'away') {
    return client.chat.postMessage({
      channel: userId,
      text: basicText,
      blocks: blocks,
    });
  }

  return client.chat.postEphemeral({
    channel: channelId,
    thread_ts: threadTs,
    user: userId,
    text: basicText,
    blocks: blocks,
  });
};
