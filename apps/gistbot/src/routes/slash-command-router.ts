import { AnalyticsManager } from '@base/gistbot-shared';
import { Feature } from '../feature-rate-limiter/limits';
import { FeatureRateLimiter } from '../feature-rate-limiter/rate-limiter';
import { Help } from '../slack/components/help';
import { responder } from '../slack/responder';
import { SlackSlashCommandWrapper } from '../slack/types';
import { isBaseTeamWorkspace, isItayOnLenny } from '../slack/utils';
import { channelSummarizationHandler } from '../summaries/channel-handler';
import { ChannelSummarizer } from '../summaries/channel/channel-summarizer';
import { summarySchedularSettingsButtonHandler } from '../summary-scheduler/handler';
import { SchedulerSettingsManager } from '../summary-scheduler/scheduler-manager';
import { ChatManager } from '../experimental/chat/manager';
import { MultiChannelSummarizer } from '../summaries/channel/multi-channel-summarizer';
import { MultiChannelSummary } from '../slack/components/multi-channel-summary';
import { parseSlackMrkdwn } from '../slack/parser';
import { generateIDAsync } from '../utils/id-generator.util';
import { WebClient } from '@slack/web-api';
import { ConnectToGmail } from '../slack/components/connect-to-gmail';
import axios from 'axios';

const BASE_URL = process.env.MAIL_BOT_SERVICE_API || '';

export const slashCommandRouter = (
  channelSummarizer: ChannelSummarizer,
  analyticsManager: AnalyticsManager,
  featureRateLimiter: FeatureRateLimiter,
  schedulerSettingsMgr: SchedulerSettingsManager,
  chatManager: ChatManager,
  multiChannelSummarizer: MultiChannelSummarizer,
) => {
  const handler = channelSummarizationHandler(
    analyticsManager,
    channelSummarizer,
    schedulerSettingsMgr,
  );

  const summarySchedulerSettings = summarySchedularSettingsButtonHandler(
    schedulerSettingsMgr,
    analyticsManager,
  );

  return async (props: SlackSlashCommandWrapper) => {
    const {
      command: { text },
      respond,
      client,
      logger,
      body: { channel_id, user_id, team_id },
    } = props;
    logger.info(`Running command ${text}`);
    if (text === 'help') {
      await props.ack();
      await responder(
        respond,
        client,
        'Hi there :wave:',
        Help(props.command.user_id),
        channel_id,
        user_id,
        { response_type: 'ephemeral' },
      );
      return;
    }
    if (text === 'gmail') {
      await props.ack();
      await client.chat.postMessage({
        channel: user_id,
        text: 'Hi there :wave:',
        blocks: ConnectToGmail(props.command.user_id, props.command.team_id),
      });
      return;
    }

    if (text === 'get mails') {
      await props.ack();
      const url = new URL(BASE_URL);
      url.pathname = '/mail/gmail-client';
      try {
        await axios.post(
          url.toString(),
          {
            slackUserId: user_id,
            slackTeamId: team_id,
          },
          {
            timeout: 60000,
          },
        );
        return;
      } catch (e) {
        logger.error(
          `get mails handler error:${url.toString()} ${e} ${e.stack}`,
        );
      }
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
          // Instead of awaiting internally we are using Promise.all and awaiting on the whole list here.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          featureRateLimiter.allowMore(
            { teamId: team_id, userId: user_id },
            f,
            5,
          );
        }),
      );
      return;
    }

    if (text.startsWith('multi')) {
      await multiChannelSummary(
        text,
        client,
        multiChannelSummarizer,
        user_id,
        team_id,
        channel_id,
      );
      return;
    }

    if (text === 'settings') {
      await summarySchedulerSettings(props);
      return;
    }

    if (text === 'chat' && isBaseTeamWorkspace(team_id)) {
      logger.info(`Handling chat command`);
      await chatManager.handleChatMessage({
        logger,
        client,
        userId: user_id,
        channelId: channel_id,
        teamId: team_id,
      });
      return;
    }

    await handler(props);
  };
};
const multiChannelSummary = async (
  text: string,
  client: WebClient,
  multiChannelSummarizer: MultiChannelSummarizer,
  userId: string,
  teamId: string,
  channelId: string,
) => {
  const parsedMrkdwn = parseSlackMrkdwn(text || '');
  parsedMrkdwn.sections.shift();
  if (parsedMrkdwn.sections.find((v) => v.type === 'channel_link')) {
    const sessionId = await generateIDAsync();

    const channelIds = parsedMrkdwn.sections
      .filter((v) => v.type === 'channel_link')
      .map((v) => {
        if (v.type !== 'channel_link') {
          throw new Error('not possible');
        }
        return v.channelId;
      });

    const channelNames = await Promise.all(
      channelIds.map(async (channelId) => {
        const {
          error: infoError,
          ok: infoOk,
          channel: channel,
        } = await client.conversations.info({
          channel: channelId,
        });
        if (infoError || !infoOk) {
          throw new Error(`Failed to fetch channel info ${infoError}`);
        }

        if (!channel) {
          throw new Error(`Failed to fetch channel info not found`);
        }

        return channel.name;
      }),
    );
    const summaries = await multiChannelSummarizer.summarize(
      'subscription',
      '',
      teamId,
      userId,
      {
        type: 'multi_channel',
        channels: channelIds.map((cid, idx) => {
          return {
            channelId: cid,
            channelName: channelNames[idx] as string,
          };
        }),
      },
      client,
      1,
    );

    const formattedMultiChannel =
      multiChannelSummarizer.getMultiChannelSummaryFormatted(summaries);

    await client.chat.postEphemeral({
      user: userId,
      channel: channelId,
      text: `Your summaries for ${channelIds.length} channels`,
      blocks: MultiChannelSummary(formattedMultiChannel, sessionId),
    });
  }
};
