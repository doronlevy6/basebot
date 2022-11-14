import { SlackBlockActionWrapper } from '../slack/types';
import { ChannelSummarizer } from './channel/channel-summarizer';
import { ChannelSummarizationProps } from './types';
import { summaryInProgressMessage } from './utils';

const ONE_WEEK_DAYS_BACK = 7;

export const channelSummaryMoreTimeHandler =
  (channelSummarizer: ChannelSummarizer) =>
  async ({ ack, logger, body, context, client }: SlackBlockActionWrapper) => {
    try {
      await ack();

      const action = body.actions[0];
      if (action.type !== 'button') {
        throw new Error(
          'summarize channel with more time received non-button action',
        );
      }

      const [props, excludedMessageId] = parseMoreTimeProps(action.value);

      await summaryInProgressMessage(client, {
        channel: props.channelId,
        user: body.user.id,
      });

      await channelSummarizer.summarize(
        'request_more_time',
        context.botId || '',
        body.team?.id || 'unknown',
        body.user.id,
        props,
        ONE_WEEK_DAYS_BACK,
        client,
        undefined,
        excludedMessageId,
      );
    } catch (error) {
      logger.error(
        `error in channel summary more time handler: ${error} ${error.stack}`,
      );
    }
  };

export const stringifyMoreTimeProps = (
  props: ChannelSummarizationProps,
  excludedMessageId: string,
) => {
  return `${props.channelId}|${props.channelName}|${excludedMessageId}`;
};

const parseMoreTimeProps = (v: string): [ChannelSummarizationProps, string] => {
  const sp = v.split('|');
  if (sp.length !== 3) {
    throw new Error(
      `incorrect length when parsing more time, got ${sp.length}`,
    );
  }
  return [
    {
      type: 'channel',
      channelId: sp[0],
      channelName: sp[1],
    },
    sp[2],
  ];
};
