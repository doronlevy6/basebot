import { MultiChannelSummary } from '../../slack/components/multi-channel-summary';
import { parseSlackMrkdwn } from '../../slack/parser';
import { SlackSlashCommandWrapper } from '../../slack/types';
import { MultiChannelSummarizer } from '../../summaries/channel/multi-channel-summarizer';
import { generateIDAsync } from '../../utils/id-generator.util';

export const multiChannelSummaryCommand = async (
  {
    client,
    command: { text },
    body: { team_id, user_id, channel_id },
  }: SlackSlashCommandWrapper,
  multiChannelSummarizer: MultiChannelSummarizer,
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
      team_id,
      user_id,
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
      user: user_id,
      channel: channel_id,
      text: `Your summaries for ${channelIds.length} channels`,
      blocks: MultiChannelSummary(formattedMultiChannel, sessionId),
    });
  }
};
