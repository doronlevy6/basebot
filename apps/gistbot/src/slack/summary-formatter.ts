import { MultiChannelSummarizerOutput } from '../summaries/channel/multi-channel-summarizer';

export const formatSummary = (
  summaries: string[],
  titles: string[],
  isThread: boolean,
) => {
  let summary = '';
  summaries = summaries.map((formattedContent, index) => {
    if (titles && titles.length === summaries.length) {
      return `*${titles[index]}*\n${formattedContent}`;
    }
    return `${formattedContent}`;
  });
  if (!isThread) {
    summaries = summaries.map((ts) => {
      return `> ${ts.replace(/\n/g, '\n> ')}`;
    });
  }
  summary = summaries.join('\n\n');
  return summary;
};

export const formatMultiChannelSummary = (
  multiChannelSummaries: MultiChannelSummarizerOutput,
  channelLinks: Map<string, string | undefined>,
) => {
  if (multiChannelSummaries.error) {
    return `:warning: ️The channels either didn’t have enough messages or failed to generate.`;
  }
  const formattedSummaries = multiChannelSummaries.summaries.map((summary) => {
    if (summary.error) {
      if (summary.error === 'moderated') {
        return `<#${summary.channelId}>\n :warning: The channel content was flagged as inapropriate.`;
      }
      return `<#${summary.channelId}>\n :warning: The channel either didn’t have enough messages or failed to generate.`;
    }
    const link = channelLinks.get(summary.channelId);

    if (link) {
      return `<${link}|#${summary.channelName}>\n${summary.summary}`;
    }
    return `<#${summary.channelId}>\n${summary.summary}`;
  });
  return formattedSummaries.join('\n\n');
};
