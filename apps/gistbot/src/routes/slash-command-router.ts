import { logger } from '@base/logger';
import { AnalyticsManager } from '../analytics/manager';
import { Feature } from '../feature-rate-limiter/limits';
import { FeatureRateLimiter } from '../feature-rate-limiter/rate-limiter';
import { Help } from '../slack/components/help';
import { responder } from '../slack/responder';
import { SlackSlashCommandWrapper } from '../slack/types';
import { isBaseTeamWorkspace, isItayOnLenny } from '../slack/utils';
import { channelSummarizationHandler } from '../summaries/channel-handler';
import { ChannelSummarizer } from '../summaries/channel/channel-summarizer';

export const slashCommandRouter = (
  channelSummarizer: ChannelSummarizer,
  analyticsManager: AnalyticsManager,
  featureRateLimiter: FeatureRateLimiter,
) => {
  const handler = channelSummarizationHandler(
    analyticsManager,
    channelSummarizer,
  );

  return async (props: SlackSlashCommandWrapper) => {
    const {
      command: { text },
      respond,
      context,
      client,
      body: { channel_id, user_id, team_id },
    } = props;
    logger.info(`Running command ${text}`);

    if (text === 'help') {
      await props.ack();
      await responder(
        respond,
        client,
        'Hi there :wave:',
        Help(props.command.user_id, context.botUserId || ''),
        channel_id,
        user_id,
        { response_type: 'ephemeral' },
      );
      return;
    }

    if (
      text === 'allow more' &&
      (isBaseTeamWorkspace(team_id) || isItayOnLenny(user_id, team_id))
    ) {
      await props.ack();
      logger.info(
        `${user_id} on team ${team_id} is requesting more for their rate limit`,
      );
      await Promise.all(
        Object.values(Feature).map((f) => {
          featureRateLimiter.allowMore(
            { teamId: team_id, userId: user_id },
            f,
            5,
          );
        }),
      );
      return;
    }

    await handler(props);
  };
};
