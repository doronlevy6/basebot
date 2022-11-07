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
