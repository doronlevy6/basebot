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
  const summariesByLang = summaries.reduce(
    (acc, summary) => {
      if (summary.language === 'english') {
        acc.english.push(summary);
        return acc;
      }
      acc.others.push(summary);
      return acc;
    },
    {
      english: [] as ConversationSummary[],
      others: [] as ConversationSummary[],
    },
  );

  const [englishSummaries, nonEnglishSummaries] = await Promise.all([
    formatEnglishSummaries(channelId, summariesByLang.english, client, opts),
    formatNonEnglishSummaries(channelId, summariesByLang.others, client, opts),
  ]);

  return `${englishSummaries}\n\n${nonEnglishSummaries}`.trim();
};

const formatEnglishSummaries = async (
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
    let formattedTitle = `*${summary.title}*`;
    if (permalink) {
      formattedTitle = `*<${permalink}|${summary.title}>*`;
    }

    return `${formattedTitle}\n${summary.summary}`;
  });

  return formattedSummaries
    .map((fs) => {
      return `> ${fs.replace(/\n/g, '\n> ')}`;
    })
    .join('\n\n');
};

const formatNonEnglishSummaries = async (
  channelId: string,
  summaries: ConversationSummary[],
  client: WebClient,
  opts: Opts,
): Promise<string> => {
  if (summaries.length === 0) {
    return '';
  }

  const permalinks = await loadPermalinks(channelId, summaries, client, opts);

  const prefix = `We currently only support English messages in our models, so unfortunately, we could not fully summarize the following threads:`;
  const formattedSummaries = summaries.map((summary, idx) => {
    const permalink = permalinks[idx];
    let formattedText = `- This thread was detected as ${summary.language}`;
    if (permalink) {
      formattedText = `- <${permalink}|This thread was detected as ${summary.language}>`;
    }

    return formattedText;
  });

  return `${prefix}\n${formattedSummaries.join('\n')}`;
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
