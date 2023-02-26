import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { ConversationSummary } from '../models/messages-summary.model';

interface Opts {
  addPermalinks: boolean;
}

export const formatConversationSummaries = async (
  channelId: string,
  summaries: ConversationSummary[],
  client: WebClient,
  opts: Opts,
): Promise<string> => {
  if (summaries.length === 0) {
    return '';
  }

  const permalinks = await loadPermalinks(channelId, summaries, client, opts);

  const formattedSummaries = summaries.map((summary, idx) => {
    const permalink = permalinks[idx];
    const cleanTitle = summary.title.replace(/^[`'"']+|[`'"']+$/g, '');

    let formattedTitle = `*${cleanTitle}*`;

    if (permalink) {
      formattedTitle = `*<${permalink}|${cleanTitle}>*`;
    }

    return `${formattedTitle}\n${summary.summary}`;
  });

  const formatted = formattedSummaries
    .map((fs) => {
      return `> ${fs.replace(/\n/g, '\n> ')}`;
    })
    .join('\n\n');

  return `${formatted}`.trim();
};

const loadPermalinks = async (
  channelId: string,
  summaries: ConversationSummary[],
  client: WebClient,
  opts: Opts,
): Promise<(string | undefined)[]> => {
  return await Promise.all(
    summaries.map(async (summary) => {
      if (
        !opts.addPermalinks ||
        // The root message ts can possibly be empty if we are working with an older version of the model,
        // so we return undefined and let the process take care of itself.
        !summary.rootMessageTs ||
        summary.rootMessageTs === ''
      ) {
        return;
      }

      try {
        const {
          error: error,
          ok: infoOk,
          permalink,
        } = await client.chat.getPermalink({
          channel: channelId,
          message_ts: summary.rootMessageTs,
        });
        if (error || !infoOk || !permalink) {
          throw new Error(`Failed to fetch chat permalink ${error}`);
        }

        return permalink;
      } catch (error) {
        logger.error({
          msg: `error in getting permalinks for message summaries`,
          error: error.message,
          stack: error.stack,
        });
      }
    }),
  );
};
