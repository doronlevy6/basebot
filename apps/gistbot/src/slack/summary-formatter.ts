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
): string[] => {
  const generalErrorText = multiChannelGeneralErrorMessage(
    multiChannelSummaries,
  );
  if (generalErrorText !== false) {
    const channelLinks = multiChannelSummaries.summaries.reduce((acc, t) => {
      return acc + `<#${t.channelId}>,`;
    }, '');
    return [`${channelLinks}\n${generalErrorText}`];
  }

  const formattedSummaries = multiChannelSummaries.summaries.map((summary) => {
    if (summary.error) {
      if (summary.error === 'moderated') {
        return `<#${summary.channelId}>\n :warning: The channel content was flagged as inapropriate.`;
      }
      if (summary.error === 'channel_too_small') {
        return `<#${summary.channelId}>\n :warning: The channel didn’t have enough messages.`;
      }
      return `<#${summary.channelId}>\n :warning: The channel failed to generate.`;
    }
    const link = channelLinks.get(summary.channelId);

    if (link) {
      return `<${link}|#${summary.channelName}>\n${summary.summary}`;
    }
    return `<#${summary.channelId}>\n${summary.summary}`;
  });

  return formattedSummaries;
};

const multiChannelGeneralErrorMessage = (
  multiChannelSummaries: MultiChannelSummarizerOutput,
): string | false => {
  let error = 0;
  let moderated = 0;
  let tooSmall = 0;
  multiChannelSummaries.summaries.forEach((s) => {
    if (s.error === 'channel_too_small') {
      tooSmall++;
    }
    if (s.error === 'moderated') {
      moderated++;
    }
    if (s.error === 'general_error') {
      error++;
    }
  });
  const sumErrors = error + moderated + tooSmall;
  if (
    (moderated > 0 &&
      error > 0 &&
      tooSmall > 0 &&
      sumErrors === multiChannelSummaries.summaries.length) ||
    multiChannelSummaries.error ||
    multiChannelSummaries.summaries.length === 0
  ) {
    return `:warning: The channels either didn’t have enough messages, were flagged as inappropriate, or failed to generate`;
  }
  if (multiChannelSummaries.summaries.length === tooSmall) {
    return `:warning: None of the channels had any meaningful conversations to summarize.`;
  }
  if (multiChannelSummaries.summaries.length === moderated) {
    return `:warning: All channels discussions were flagged as inappropriate`;
  }
  if (multiChannelSummaries.summaries.length === error) {
    return `:warning: Summary generation failed, we are on it!`;
  }
  if (
    moderated > 0 &&
    tooSmall > 0 &&
    sumErrors === multiChannelSummaries.summaries.length
  ) {
    return `:warning: The channels either didn’t have enough messages or were flagged as inappropriate`;
  }
  if (
    moderated > 0 &&
    error > 0 &&
    sumErrors === multiChannelSummaries.summaries.length
  ) {
    return `:warning: The channels were either flagged as inappropriate or failed to generate”`;
  }
  if (
    tooSmall > 0 &&
    error > 0 &&
    sumErrors === multiChannelSummaries.summaries.length
  ) {
    return `:warning: The channels either didn’t have enough messages or failed to generate”`;
  }
  return false;
};
